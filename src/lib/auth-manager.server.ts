import type { SupabaseClient } from "@supabase/supabase-js";
import { makeShopifyClient, decryptToken } from "./shopify.server";
import type { ShopifyClient } from "./shopify.server";

export class AuthManager {
  /**
   * Universal abstraction to obtain an authenticated ShopifyClient for a given store.
   * Neither the Backup nor Restore engine needs to know how the store authenticated.
   */
  static async getUnifiedClient(
    supabaseAdmin: SupabaseClient,
    storeId: string,
  ): Promise<ShopifyClient> {
    const { data: store, error } = await supabaseAdmin
      .from("stores")
      .select("shop_domain, access_token_ciphertext")
      .eq("id", storeId)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error looking up store: ${error.message}`);
    }
    if (!store) {
      throw new Error(`Store not found: ${storeId}`);
    }
    if (!store.access_token_ciphertext) {
      throw new Error(`Store ${store.shop_domain} is missing an access token.`);
    }

    const token = decryptToken(store.access_token_ciphertext);
    return makeShopifyClient(store.shop_domain, token);
  }

  /**
   * Universal abstraction to obtain an authenticated ShopifyClient by domain.
   */
  static async getUnifiedClientByDomain(
    supabaseAdmin: SupabaseClient,
    shopDomain: string,
  ): Promise<ShopifyClient> {
    const { data: store, error } = await supabaseAdmin
      .from("stores")
      .select("shop_domain, access_token_ciphertext")
      .eq("shop_domain", shopDomain)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error looking up store domain: ${error.message}`);
    }
    if (!store) {
      throw new Error(`Store not found for domain: ${shopDomain}`);
    }
    if (!store.access_token_ciphertext) {
      throw new Error(`Store ${store.shop_domain} is missing an access token.`);
    }

    const token = decryptToken(store.access_token_ciphertext);
    return makeShopifyClient(store.shop_domain, token);
  }
}
