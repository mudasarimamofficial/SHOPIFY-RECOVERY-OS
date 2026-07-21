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
      .select("shop_domain, access_token_ciphertext, is_destination")
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
    const baseClient = makeShopifyClient(store.shop_domain, token);

    // Apply strict RBAC
    return this.enforceRBAC(baseClient, store.is_destination);
  }

  private static enforceRBAC(client: ShopifyClient, isDestination: boolean): ShopifyClient {
    return {
      ...client,
      async rest<T>(path: string, options?: RequestInit): Promise<T> {
        const method = (options?.method || "GET").toUpperCase();
        if (isDestination && method === "GET" && path.includes("/bulk")) {
          throw new Error(
            "SECURITY VIOLATION: Store B (Destination) cannot perform bulk extractions.",
          );
        }
        if (!isDestination && ["POST", "PUT", "DELETE"].includes(method)) {
          throw new Error("SECURITY VIOLATION: Store A (Source) is strictly Read-Only.");
        }
        return client.rest<T>(path, options);
      },
      async graphql<T>(query: string, variables?: any): Promise<T> {
        const isMutation = query.trim().toLowerCase().startsWith("mutation");
        if (!isDestination && isMutation) {
          throw new Error("SECURITY VIOLATION: Store A (Source) is strictly Read-Only.");
        }
        if (isDestination && !isMutation && query.includes("bulkOperationRunQuery")) {
          throw new Error(
            "SECURITY VIOLATION: Store B (Destination) cannot perform bulk extractions.",
          );
        }
        return client.graphql<T>(query, variables);
      },
    };
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
