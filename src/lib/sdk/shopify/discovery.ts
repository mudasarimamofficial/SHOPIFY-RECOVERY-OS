import type { ShopifySDK } from "./client";

export class WebhookDiscovery {
  constructor(private sdk: ShopifySDK) {}

  /**
   * Discovers all webhooks currently registered on the store.
   * Useful for Risk Reports or migrating webhooks during a full platform restore.
   */
  async getRegisteredWebhooks(): Promise<any[]> {
    const webhooks = [];
    const query = `
      query {
        webhookSubscriptions(first: 50) {
          edges {
            node {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
                ... on WebhookEventBridgeEndpoint {
                  arn
                }
                ... on WebhookPubSubEndpoint {
                  pubSubProject
                  pubSubTopic
                }
              }
            }
          }
        }
      }
    `;

    for await (const chunk of this.sdk.paginateGraphQL<any>(query, "webhookSubscriptions")) {
      webhooks.push(...chunk);
    }
    return webhooks;
  }
}

export class VersionAdapter {
  constructor(private sdk: ShopifySDK) {}

  /**
   * Pings the Shopify API to retrieve the current supported versions.
   * Ensures the platform doesn't crash if a hardcoded version gets deprecated.
   */
  async getSupportedApiVersions(): Promise<string[]> {
    // Note: To get versions without knowing a version, we can hit the REST endpoint or GraphQL publicSchema
    // Shopify guarantees /admin/api/unstable is always available for this
    try {
      const res = await this.sdk.rest<{
        public_api_versions: { handle: string; supported: boolean }[];
      }>("GET", "../unstable/public_api_versions.json");
      return res.public_api_versions.filter((v) => v.supported).map((v) => v.handle);
    } catch (err) {
      console.warn("[VersionAdapter] Failed to fetch API versions. Falling back to default.");
      return ["2024-01", "2024-04", "2024-07", "2024-10"];
    }
  }

  /**
   * Analyzes an upcoming API deprecation warning returned in a GraphQL extension payload.
   */
  logDeprecationWarnings(extensions: any) {
    if (extensions?.deprecations?.length > 0) {
      console.warn(`[ShopifySDK] API Deprecation Warnings detected:`, extensions.deprecations);
      // We could push these into the EventBus for the AI Engine to flag
    }
  }
}
