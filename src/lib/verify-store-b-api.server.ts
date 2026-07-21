import { createClient } from "@supabase/supabase-js";
import { decryptToken, makeShopifyClient } from "./shopify.server";
import { SHOPIFY_SCOPES } from "./shopify-oauth.server";

export async function handleVerifyStoreBApi(_request: Request) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const partnerClientId = process.env.SHOPIFY_API_KEY_STORE_B || process.env.SHOPIFY_API_KEY; // Use Store B key if available

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase credentials in Production" }), {
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Partner App Details
    const partnerConfig = {
      configured: !!partnerClientId,
      clientId: partnerClientId
        ? `${partnerClientId.slice(0, 4)}...${partnerClientId.slice(-4)}`
        : null,
    };

    // 2. Find Stores
    const { data: stores, error: storesError } = await supabase.from("stores").select("*");
    if (storesError) {
      return new Response(JSON.stringify({ error: storesError.message }), { status: 500 });
    }

    const storeResults = [];

    const requiredScopes = SHOPIFY_SCOPES.split(",");

    for (const store of stores || []) {
      if (!store.access_token_ciphertext) {
        storeResults.push({
          domain: store.shop_domain,
          status: "No Token",
        });
        continue;
      }

      try {
        const token = decryptToken(store.access_token_ciphertext);
        const client = makeShopifyClient(store.shop_domain, token);

        // Test /shop.json
        let shopData = null;
        let shopError = null;
        try {
          const res = await client.rest<any>("/shop.json");
          shopData = res.shop ? res.shop.domain : null;
        } catch (e: any) {
          shopError = e.message;
        }

        // Test access scopes
        let scopesData: string[] = [];
        try {
          const scopeRes = await client.rest<any>("/oauth/access_scopes.json").catch(() => null);
          if (scopeRes && scopeRes.access_scopes) {
            scopesData = scopeRes.access_scopes.map((s: any) => s.handle);
          }
        } catch (_e) {
          // ignore
        }

        const missingScopes = requiredScopes.filter((s) => !scopesData.includes(s));

        storeResults.push({
          domain: store.shop_domain,
          status: shopData ? "Active" : "Invalid Token",
          shopResponse: shopData,
          shopError,
          scopesGranted: scopesData,
          missingScopes:
            scopesData.length > 0 ? missingScopes : "Could not determine (Custom App?)",
          sufficientPermissions: scopesData.length > 0 ? missingScopes.length === 0 : "Unknown",
        });
      } catch (e: any) {
        storeResults.push({
          domain: store.shop_domain,
          status: "Decryption Failed",
          error: e.message,
        });
      }
    }

    return new Response(JSON.stringify({ partnerConfig, stores: storeResults }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500 });
  }
}
