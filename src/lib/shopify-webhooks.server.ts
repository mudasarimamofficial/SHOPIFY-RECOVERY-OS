// Shopify webhook receiver. Verifies the HMAC signature over the raw request
// body with a timing-safe comparison, then routes by topic. This is the single
// server-to-server surface Shopify calls; there is no OAuth flow (the app uses
// the Custom App token model — see src/routes/_authenticated/connect.tsx).
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CLIENT_SECRET = process.env.SHOPIFY_API_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env vars");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Verifies the Shopify webhook HMAC over the exact raw body bytes.
 * Uses a constant-time comparison to avoid timing side channels.
 */
export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!CLIENT_SECRET || !hmacHeader) return false;
  const digest = createHmac("sha256", CLIENT_SECRET).update(rawBody, "utf8").digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(hmacHeader, "base64");
  } catch {
    return false;
  }
  // timingSafeEqual throws if lengths differ, so guard first.
  if (provided.length !== digest.length) return false;
  return timingSafeEqual(provided, digest);
}

async function handleAppUninstalled(shopDomain: string): Promise<void> {
  if (!shopDomain) return;
  const supabase = getSupabase();
  // Revoke the stored token and mark the store uninstalled. The token is dead
  // on Shopify's side once uninstalled, so we clear it from our store record.
  await supabase
    .from("stores")
    .update({ status: "uninstalled", access_token_ciphertext: "" })
    .eq("shop_domain", shopDomain);
}

/**
 * GDPR mandatory webhooks. This platform stores encrypted Admin API tokens and
 * backup metadata keyed by shop domain — not individual customer PII — so the
 * data-request/redact topics are acknowledged; shop/redact purges the store row.
 */
async function handleShopRedact(shopDomain: string): Promise<void> {
  if (!shopDomain) return;
  const supabase = getSupabase();
  await supabase.from("stores").delete().eq("shop_domain", shopDomain);
}

export async function handleShopifyWebhooks(request: Request): Promise<Response> {
  // Read the raw body BEFORE any JSON parsing — HMAC is computed over raw bytes.
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

  if (!verifyWebhookHmac(rawBody, hmacHeader)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") ?? "";
  const shopDomain = request.headers.get("x-shopify-shop-domain") ?? "";

  try {
    switch (topic) {
      case "app/uninstalled":
        await handleAppUninstalled(shopDomain);
        break;
      case "shop/redact":
        await handleShopRedact(shopDomain);
        break;
      case "customers/data_request":
      case "customers/redact":
        // No standalone customer PII is retained beyond backup archives, which
        // are governed by the merchant's own retention. Acknowledged.
        break;
      default:
        // Unknown/unsubscribed topic — acknowledge so Shopify does not retry.
        break;
    }
  } catch (err) {
    console.error(`Webhook handler error for topic "${topic}":`, err);
    // Return 500 so Shopify retries transient failures.
    return new Response("Webhook processing failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
