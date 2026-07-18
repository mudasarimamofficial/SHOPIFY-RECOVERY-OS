// Official Shopify OAuth (Authorization Code grant, offline token) for the
// installed Partner App. Server-only. The user never sees or pastes a token.
//
//   Connect page (shop only) -> beginShopifyOAuth (authed server fn)
//     -> redirect to https://{shop}/admin/oauth/authorize
//     -> merchant approves
//     -> GET /api/auth/callback (handled in server.ts)
//        -> verify query HMAC + one-time state -> exchange code for offline token
//        -> encrypt + store -> register webhooks -> redirect into the app
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SHOPIFY_API_VERSION,
  encryptToken,
  makeShopifyClient,
  fetchShopInfo,
} from "./shopify.server";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env vars");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const APP_URL = (
  process.env.SHOPIFY_APP_URL ||
  process.env.APP_URL ||
  "https://shopify-recovery-os.vercel.app"
).replace(/\/$/, "");

export const OAUTH_REDIRECT_URI = `${APP_URL}/api/auth/callback`;
export const WEBHOOK_CALLBACK_URL = `${APP_URL}/api/webhooks`;

// Requested scopes must be a subset of the app's configured scopes
// (shopify.app.toml [access_scopes]). write_* implies the matching read_*.
export const SHOPIFY_SCOPES =
  process.env.SHOPIFY_SCOPES ||
  "write_products,write_customers,write_orders,write_draft_orders,write_content,write_files,write_themes,write_metaobject_definitions,write_metaobjects,write_inventory,write_locations,read_legal_policies,write_shipping,write_discounts,write_translations,write_online_store_navigation,write_price_rules,write_locales";

const SHOP_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function normalizeShop(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!d.includes(".")) d = `${d}.myshopify.com`;
  return d;
}

export function isValidShopDomain(shop: string): boolean {
  return SHOP_REGEX.test(shop);
}

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(shop: string, state: string): string {
  if (!API_KEY) throw new Error("SHOPIFY_API_KEY is not configured");
  const params = new URLSearchParams({
    client_id: API_KEY,
    scope: SHOPIFY_SCOPES,
    redirect_uri: OAUTH_REDIRECT_URI,
    state,
    // Empty grant_options[] requests an OFFLINE (permanent) access token,
    // which is what background backup/restore jobs need.
    "grant_options[]": "",
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Verifies the HMAC Shopify appends to the OAuth callback query string.
 * All params except `hmac`/`signature` are sorted and joined `k=v&…`, then
 * HMAC-SHA256'd with the app secret and compared in constant time.
 */
export function verifyCallbackHmac(params: URLSearchParams): boolean {
  if (!API_SECRET) return false;
  const hmac = params.get("hmac");
  if (!hmac) return false;

  const entries: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k === "hmac" || k === "signature") continue;
    entries.push(`${k}=${v}`);
  }
  entries.sort();
  const message = entries.join("&");
  const digest = createHmac("sha256", API_SECRET).update(message).digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(hmac, "hex");
  } catch {
    return false;
  }
  if (provided.length !== digest.length) return false;
  return timingSafeEqual(provided, digest);
}

/**
 * Rejects OAuth callbacks whose `timestamp` is stale or in the future
 * (defense-in-depth against replayed authorization redirects, on top of the
 * one-time state). Shopify sends `timestamp` in unix seconds.
 */
export function isTimestampFresh(
  timestamp: string | null,
  nowMs: number,
  toleranceSec = 300,
): boolean {
  if (!timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(nowMs / 1000);
  return Math.abs(nowSec - ts) <= toleranceSec;
}

export interface TokenExchangeResult {
  access_token: string;
  scope: string;
}

/** Exchanges the authorization code for an offline Admin API access token. */
export async function exchangeCodeForToken(
  shop: string,
  code: string,
): Promise<TokenExchangeResult> {
  if (!API_KEY || !API_SECRET) {
    throw new Error("Shopify API credentials are not configured");
  }
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, code }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string; scope?: string };
  if (!json.access_token) throw new Error("Token exchange returned no access_token");
  return { access_token: json.access_token, scope: json.scope ?? "" };
}

// Operational webhooks registered via the API after install. GDPR compliance
// topics (customers/data_request, customers/redact, shop/redact) are delivered
// to the URLs declared in shopify.app.toml [webhooks.privacy_compliance].
const WEBHOOK_TOPICS = ["APP_UNINSTALLED", "APP_SCOPES_UPDATE"] as const;

export interface WebhookRegistration {
  topic: string;
  id: string | null;
  errors: string[];
}

/** Idempotently registers operational webhooks. Existing subs are treated as success. */
export async function registerWebhooks(
  shop: string,
  token: string,
): Promise<WebhookRegistration[]> {
  const mutation = `
    mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
        webhookSubscription { id }
        userErrors { field message }
      }
    }`;

  const out: WebhookRegistration[] = [];
  for (const topic of WEBHOOK_TOPICS) {
    try {
      const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({
          query: mutation,
          variables: { topic, sub: { callbackUrl: WEBHOOK_CALLBACK_URL, format: "JSON" } },
        }),
      });
      const json = (await res.json()) as any;
      const result = json?.data?.webhookSubscriptionCreate;
      const userErrors: Array<{ message: string }> = result?.userErrors ?? [];
      // "already been taken" means the subscription already exists — that's fine.
      const errors = userErrors
        .map((e) => e.message)
        .filter((m) => !/already.*taken|already exists/i.test(m));
      out.push({ topic, id: result?.webhookSubscription?.id ?? null, errors });
    } catch (err: any) {
      out.push({ topic, id: null, errors: [err?.message ?? "request failed"] });
    }
  }
  return out;
}

function redirectTo(origin: string, path: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${origin}${path}` } });
}

/**
 * Handles GET /api/auth/callback. Verifies the request came from Shopify (query
 * HMAC), consumes the one-time state (CSRF + replay), exchanges the code for an
 * offline token, verifies it against the Admin API, stores it encrypted, and
 * registers webhooks. Returns a 302 into the app (never exposes the token).
 */
export async function handleOAuthCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const params = url.searchParams;
  const shop = (params.get("shop") ?? "").toLowerCase();
  const code = params.get("code") ?? "";
  const state = params.get("state") ?? "";

  if (!isValidShopDomain(shop) || !code || !state) {
    return redirectTo(origin, "/connect?error=invalid_request");
  }
  if (!verifyCallbackHmac(params)) {
    return redirectTo(origin, "/connect?error=hmac_failed");
  }
  if (!isTimestampFresh(params.get("timestamp"), Date.now())) {
    return redirectTo(origin, "/connect?error=timestamp_invalid");
  }

  const supabase = getSupabaseAdmin();

  // Consume the one-time state row (delete + return) => CSRF + replay protection.
  const { data: session, error: sErr } = await supabase
    .from("oauth_sessions")
    .delete()
    .eq("state", state)
    .select("user_id, shop_domain")
    .maybeSingle();
  if (sErr || !session) return redirectTo(origin, "/connect?error=state_invalid");
  if (session.shop_domain !== shop) return redirectTo(origin, "/connect?error=shop_mismatch");

  try {
    const { access_token, scope } = await exchangeCodeForToken(shop, code);

    // Verify the freshly-issued token against the Admin REST API.
    const client = makeShopifyClient(shop, access_token);
    const info = (await fetchShopInfo(client)) as Record<string, any>;

    const ciphertext = encryptToken(access_token);
    const scopesArray = scope
      ? scope
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const { data: row, error: upErr } = await supabase
      .from("stores")
      .upsert(
        {
          user_id: session.user_id,
          shop_domain: shop,
          shop_id: info.id != null ? String(info.id) : null,
          name: info.name ?? null,
          plan: info.plan_display_name ?? info.plan_name ?? null,
          country: info.country_name ?? null,
          currency: info.currency ?? null,
          email: info.email ?? null,
          timezone: info.iana_timezone ?? null,
          api_version: SHOPIFY_API_VERSION,
          scopes: scopesArray,
          access_token_ciphertext: ciphertext,
          status: "connected",
          auth_method: "oauth",
          installed_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,shop_domain" },
      )
      .select("id")
      .single();
    if (upErr) throw new Error(upErr.message);

    // Register operational webhooks (idempotent; failures are non-fatal here).
    await registerWebhooks(shop, access_token);

    await supabase.from("activity_log").insert({
      user_id: session.user_id,
      store_id: row.id,
      kind: "connect",
      title: `Connected ${shop} via Shopify OAuth`,
      detail: `Granted ${scopesArray.length} scopes`,
    });

    return redirectTo(origin, `/stores/${row.id}`);
  } catch (err: any) {
    const msg = encodeURIComponent(String(err?.message ?? "oauth_failed").slice(0, 120));
    return redirectTo(origin, `/connect?error=${msg}`);
  }
}
