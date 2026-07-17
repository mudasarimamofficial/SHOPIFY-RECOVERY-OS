import { ApiAdapter } from "./registry";

interface AdapterConfig {
  domain: string;
  token: string;
  apiVersion: string;
}

export class ShopifyAdapter implements ApiAdapter {
  constructor(private config: AdapterConfig) {}
  
  async graphql<T>(query: string, variables?: Record<string, unknown>, attempts = 0): Promise<T> {
    const res = await fetch(`https://${this.config.domain}/admin/api/${this.config.apiVersion}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": this.config.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.graphql(query, variables, attempts + 1);
    }
    
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Shopify GraphQL ${res.status}: ${body.slice(0, 200)}`);
    }
    
    const json = (await res.json()) as { data?: T; errors?: any[]; extensions?: any };
    
    // Enterprise Cost-Tracking & Backpressure
    if (json.extensions?.cost?.throttleStatus) {
      const { currentlyAvailable, restoreRate } = json.extensions.cost.throttleStatus;
      if (currentlyAvailable < 100) {
        const waitMs = Math.ceil((100 / restoreRate) * 1000);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    
    if (json.errors && json.errors.length > 0) {
      const isThrottled = json.errors.some((e: any) => e.extensions?.code === "THROTTLED");
      if (isThrottled && attempts < 5) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000));
        return this.graphql(query, variables, attempts + 1);
      }
      throw new Error(`Shopify GraphQL Error: ${JSON.stringify(json.errors)}`);
    }
    
    return json.data as T;
  }
  
  async rest<T>(method: string, path: string, body?: any, attempts = 0): Promise<T> {
    const url = `https://${this.config.domain}/admin/api/${this.config.apiVersion}/${path.replace(/^\//, '')}`;
    const res = await fetch(url, {
      method,
      headers: {
        "X-Shopify-Access-Token": this.config.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.rest(method, path, body, attempts + 1);
    }
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Shopify REST ${res.status}: ${errorText.slice(0, 200)}`);
    }
    
    return res.json() as Promise<T>;
  }

  /**
   * Enterprise Pagination: Auto-yields chunks of Shopify GraphQL connection edges.
   */
  async *paginateGraphQL<T>(query: string, dataPath: string, variables: Record<string, unknown> = {}): AsyncGenerator<T[], void, unknown> {
    let hasNextPage = true;
    let endCursor: string | null = null;
    
    while (hasNextPage) {
      const vars = { ...variables, cursor: endCursor };
      const res: any = await this.graphql(query, vars);
      
      const connection = dataPath.split('.').reduce((acc, part) => acc && acc[part], res);
      
      if (!connection) throw new Error(`Invalid pagination dataPath: ${dataPath}`);
      
      const nodes = connection.edges ? connection.edges.map((e: any) => e.node) : connection.nodes || [];
      if (nodes.length > 0) yield nodes;
      
      hasNextPage = connection.pageInfo?.hasNextPage || false;
      endCursor = connection.pageInfo?.endCursor || null;
    }
  }
}
