import { RateLimiter, withExponentialBackoff } from "./rate-limiter";
import { BulkOperations } from "./bulk-operations";

export interface ShopifyConfig {
  domain: string;
  token: string;
  apiVersion: string;
}

export class ShopifySDK {
  public bulk: BulkOperations;
  private rateLimiter = new RateLimiter();

  constructor(private config: ShopifyConfig) {
    this.bulk = new BulkOperations(this);
  }

  async graphql<T>(
    query: string,
    variables: Record<string, unknown> = {},
    estimatedCost = 50,
  ): Promise<T> {
    return withExponentialBackoff(async () => {
      await this.rateLimiter.awaitCapacity(estimatedCost);

      const res = await fetch(
        `https://${this.config.domain}/admin/api/${this.config.apiVersion}/graphql.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": this.config.token,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ query, variables }),
        },
      );

      if (!res.ok) {
        if (res.status === 429) throw new Error("THROTTLED");
        const body = await res.text().catch(() => "");
        throw new Error(`Shopify GraphQL ${res.status}: ${body.slice(0, 200)}`);
      }

      const json = (await res.json()) as any;

      // Update our internal leaky bucket state based on the actual cost returned
      this.rateLimiter.updateCost(json.extensions);

      if (json.errors && json.errors.length > 0) {
        if (json.errors.some((e: any) => e.extensions?.code === "THROTTLED")) {
          throw new Error("THROTTLED"); // Triggers exponential backoff
        }
        throw new Error(`Shopify GraphQL Error: ${JSON.stringify(json.errors)}`);
      }

      return json.data as T;
    });
  }

  async rest<T>(method: string, path: string, body?: any): Promise<T> {
    return withExponentialBackoff(async () => {
      const url = `https://${this.config.domain}/admin/api/${this.config.apiVersion}/${path.replace(/^\//, "")}`;
      const res = await fetch(url, {
        method,
        headers: {
          "X-Shopify-Access-Token": this.config.token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        if (res.status === 429) throw new Error("THROTTLED");
        const errorText = await res.text().catch(() => "");
        throw new Error(`Shopify REST ${res.status}: ${errorText.slice(0, 200)}`);
      }

      return res.json() as Promise<T>;
    });
  }

  async *paginateGraphQL<T>(
    query: string,
    dataPath: string,
    variables: Record<string, unknown> = {},
  ): AsyncGenerator<T[], void, unknown> {
    let hasNextPage = true;
    let endCursor: string | null = null;

    while (hasNextPage) {
      const vars = { ...variables, cursor: endCursor };
      const res: any = await this.graphql(query, vars);

      const connection = dataPath.split(".").reduce((acc, part) => acc && acc[part], res);
      if (!connection) throw new Error(`Invalid pagination dataPath: ${dataPath}`);

      const nodes = connection.edges
        ? connection.edges.map((e: any) => e.node)
        : connection.nodes || [];
      if (nodes.length > 0) yield nodes;

      hasNextPage = connection.pageInfo?.hasNextPage || false;
      endCursor = connection.pageInfo?.endCursor || null;
    }
  }
}
