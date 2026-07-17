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

export async function handleShopifyWebhooks(request: Request): Promise<Response> {
  // Simple success response for privacy webhooks
  return new Response("Webhook received", { status: 200 });
}
