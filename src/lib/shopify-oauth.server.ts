import { createHash, randomBytes, createHmac } from "node:crypto";
import { encryptToken, fetchShopInfo, makeShopifyClient } from "./shopify.server";
import { createClient } from "@supabase/supabase-js";

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce((acc, cookie) => {
    const [key, ...v] = cookie.split('=');
    try {
      acc[key.trim()] = decodeURIComponent(v.join('=').trim());
    } catch {
      acc[key.trim()] = v.join('=').trim();
    }
    return acc;
  }, {} as Record<string, string>);
}

function serializeCookie(name: string, value: string, options: { httpOnly?: boolean, secure?: boolean, sameSite?: string, path?: string, maxAge?: number }) {
  let cookie = `${name}=${value}`;
  if (options.httpOnly) cookie += "; HttpOnly";
  if (options.secure) cookie += "; Secure";
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
  return cookie;
}

const CLIENT_ID = process.env.SHOPIFY_API_KEY;
const CLIENT_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = process.env.SCOPES || "write_products,read_legal_policies,write_content,write_customers,write_discounts,write_draft_orders,write_files,write_inventory,write_locales,write_locations,write_metaobject_definitions,write_metaobjects,write_online_store_navigation,write_orders,write_price_rules,write_shipping,write_themes,write_translations";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env vars");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function verifyHmac(query: URLSearchParams): boolean {
  if (!CLIENT_SECRET) return false;
  const hmac = query.get("hmac");
  if (!hmac) return false;

  const map = new Map<string, string>();
  for (const [key, value] of query.entries()) {
    if (key === "hmac" || key === "signature") continue;
    map.set(key, value);
  }
  const keys = Array.from(map.keys()).sort();
  const message = keys.map((k) => `${k}=${map.get(k)}`).join("&");
  const generatedHash = createHmac("sha256", CLIENT_SECRET).update(message).digest("hex");
  return generatedHash === hmac;
}

export async function handleShopifyAuth(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!shop) {
    return new Response("Missing shop parameter", { status: 400 });
  }

  // Ensure user is logged in
  const cookies = parseCookies(request.headers.get("cookie") || "");
  // Actually, we can get user session from Supabase client using cookies if we have them.
  // Instead, let's just let the frontend pass a user_id or we extract it.
  // We'll store the redirect in a cookie and redirect to /auth if no user cookie.
  const sbCookie = Object.keys(cookies).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
  
  if (!sbCookie) {
    // Redirect to login page and come back
    const redirectUrl = new URL("/auth", url.origin);
    redirectUrl.searchParams.set("return_to", url.pathname + url.search);
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl.toString() },
    });
  }

  const sessionStr = cookies[sbCookie];
  let userId: string | null = null;
  try {
    const session = JSON.parse(sessionStr);
    userId = session?.user?.id;
  } catch(e) {
    // parse error
  }

  if (!userId) {
    const redirectUrl = new URL("/auth", url.origin);
    redirectUrl.searchParams.set("return_to", url.pathname + url.search);
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl.toString() },
    });
  }

  const state = randomBytes(16).toString("hex");
  const stateCookie = serializeCookie("shopify_oauth_state", state, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  const redirectUri = `${url.origin}/api/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPES}&redirect_uri=${redirectUri}&state=${state}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: installUrl,
      "Set-Cookie": stateCookie,
    },
  });
}

export async function handleShopifyAuthCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!shop || !code || !state) {
    return new Response("Missing parameters", { status: 400 });
  }

  if (!verifyHmac(url.searchParams)) {
    return new Response("HMAC validation failed", { status: 400 });
  }

  const cookies = parseCookies(request.headers.get("cookie") || "");
  if (cookies.shopify_oauth_state !== state) {
    return new Response("State validation failed", { status: 400 });
  }

  // Get user_id from Supabase cookie again
  const sbCookie = Object.keys(cookies).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
  if (!sbCookie) {
    return new Response("Unauthorized", { status: 401 });
  }
  let userId: string | null = null;
  try {
    const session = JSON.parse(cookies[sbCookie]);
    userId = session?.user?.id;
  } catch(e) {}
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Exchange code for access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("Token exchange failed", text);
    return new Response("Failed to exchange token", { status: 500 });
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const scopes = tokenData.scope.split(",");

  const encryptedToken = encryptToken(accessToken);

  // Fetch shop info
  const client = makeShopifyClient(shop, accessToken);
  const shopInfo = await fetchShopInfo(client);

  // Save to Supabase
  const supabase = getSupabase();
  const { error } = await supabase.from("stores").upsert({
    user_id: userId,
    shop_domain: shop,
    name: shopInfo.name,
    plan: shopInfo.plan_name,
    country: shopInfo.country_name,
    currency: shopInfo.currency,
    email: shopInfo.email,
    api_version: "2024-10",
    scopes: scopes,
    access_token_ciphertext: encryptedToken,
    status: "connected",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,shop_domain" });

  if (error) {
    console.error("Failed to save store", error);
    return new Response("Internal error saving store", { status: 500 });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: "/dashboard" },
  });
}

export async function handleShopifyWebhooks(request: Request): Promise<Response> {
  // Simple success response for privacy webhooks
  return new Response("Webhook received", { status: 200 });
}
