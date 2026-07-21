// Server-only helpers: encryption + Shopify Admin API client.
// Only import from other .server.ts files or from inside server-fn handlers.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";

function key() {
  const raw = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY not configured");
  // hex or base64; derive 32-byte key via sha256
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptToken(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const d = createDecipheriv(ALGO, key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

export const SHOPIFY_API_VERSION = "2024-10";

export function normalizeShopDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!d.includes(".")) d = `${d}.myshopify.com`;
  return d;
}

export interface ShopifyClient {
  domain: string;
  rest<T = unknown>(path: string, init?: RequestInit): Promise<T>;
  paged<T = unknown>(path: string, key: string, limit?: number): Promise<T[]>;
  pagedCount(path: string, key: string, limit?: number): Promise<number>;
  graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
  paginateGraphQL<T = unknown>(
    queryBuilder: (cursor: string | null) => string,
    extractPath: string[],
  ): Promise<T[]>;
}

export function makeShopifyClient(domain: string, token: string): ShopifyClient {
  const base = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}`;
  async function rest<T>(path: string, init: RequestInit = {}, attempts = 0): Promise<T> {
    const res = await fetch(base + path, {
      ...init,
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });
    if (res.status === 429) {
      if (attempts > 7) throw new Error("Max retries exceeded for REST API.");
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      const backoffMs = Math.max(retryAfter * 1000, Math.pow(2, attempts) * 1000);
      await new Promise((r) => setTimeout(r, backoffMs));
      return rest(path, init, attempts + 1);
    }
    // Also retry on 500, 502, 503, 504
    if (res.status >= 500 && res.status < 600) {
      if (attempts > 5) throw new Error(`Shopify Server Error ${res.status} after retries.`);
      await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000));
      return rest(path, init, attempts + 1);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Shopify ${res.status} on ${path}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }
  async function paged<T>(path: string, key: string, limit = 250): Promise<T[]> {
    const out: T[] = [];
    let url = path + (path.includes("?") ? "&" : "?") + `limit=${limit}`;
    let safety = 100000; // allow deeper pagination (25M items)
    let consecutiveFailures = 0;
    while (safety-- > 0) {
      const res = await fetch(base + url, {
        headers: {
          "X-Shopify-Access-Token": token,
          Accept: "application/json",
        },
      });
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
        await new Promise((r) =>
          setTimeout(r, Math.max(retryAfter * 1000, Math.pow(2, consecutiveFailures) * 1000)),
        );
        consecutiveFailures++;
        continue;
      }
      if (res.status >= 500 && res.status < 600) {
        if (consecutiveFailures > 5)
          throw new Error(`Shopify Server Error ${res.status} on ${url} after retries.`);
        await new Promise((r) => setTimeout(r, Math.pow(2, consecutiveFailures) * 1000));
        consecutiveFailures++;
        continue;
      }
      consecutiveFailures = 0; // reset on success
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Shopify ${res.status} on ${url}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as Record<string, T[]>;
      const items = data[key] ?? [];
      out.push(...items);
      if (out.length > 100000) {
        throw new Error(
          `Data too large for REST extraction. Exceeded memory-safe limit of 100,000 items for ${path}.`,
        );
      }
      const link = res.headers.get("link") ?? "";
      const next = link.match(/<([^>]+)>;\s*rel="next"/);
      if (!next || items.length === 0) break;
      const u = new URL(next[1]);
      url = u.pathname.replace(/^\/admin\/api\/[^/]+/, "") + u.search;
    }

    if (safety <= 0) {
      throw new Error(`Pagination limit exceeded for ${path}. Maximum depth reached.`);
    }

    return out;
  }
  async function pagedCount(path: string, key: string, limit = 250): Promise<number> {
    let count = 0;
    let url = path + (path.includes("?") ? "&" : "?") + `limit=${limit}`;
    let safety = 100000;
    let consecutiveFailures = 0;
    while (safety-- > 0) {
      const res = await fetch(base + url, {
        headers: { "X-Shopify-Access-Token": token, Accept: "application/json" },
      });
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
        await new Promise((r) =>
          setTimeout(r, Math.max(retryAfter * 1000, Math.pow(2, consecutiveFailures) * 1000)),
        );
        consecutiveFailures++;
        continue;
      }
      if (res.status >= 500 && res.status < 600) {
        if (consecutiveFailures > 5)
          throw new Error(`Shopify Server Error ${res.status} after retries.`);
        await new Promise((r) => setTimeout(r, Math.pow(2, consecutiveFailures) * 1000));
        consecutiveFailures++;
        continue;
      }
      consecutiveFailures = 0;
      if (!res.ok) throw new Error(`Shopify ${res.status} on ${url}`);
      const data = (await res.json()) as any;
      const items = data[key] ?? [];
      count += items.length;
      const link = res.headers.get("link") ?? "";
      const next = link.match(/<([^>]+)>;\s*rel="next"/);
      if (!next || items.length === 0) break;
      const u = new URL(next[1]);
      url = u.pathname.replace(/^\/admin\/api\/[^/]+/, "") + u.search;
    }
    return count;
  }
  async function graphql<T>(
    query: string,
    variables?: Record<string, unknown>,
    attempts = 0,
  ): Promise<T> {
    const startTime = performance.now();
    const payload = JSON.stringify({ query, variables });
    const res = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: payload,
    });
    const executionTime = Math.round(performance.now() - startTime);

    let json: any = {};
    let rawText = "";
    if (res.ok || res.status === 400 || res.status === 429) {
      rawText = await res.text().catch(() => "");
      try {
        json = JSON.parse(rawText);
      } catch (_e) {
        if (res.ok) throw new Error(`Shopify GraphQL JSON parsing failed`);
      }
    }

    const cost = json.extensions?.cost?.actualQueryCost || "?";
    const heap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    console.log(
      `[FORENSIC-GQL] API: ${SHOPIFY_API_VERSION} | ATTEMPTS: ${attempts} | STATUS: ${res.status} | TIME: ${executionTime}ms | COST: ${cost} | HEAP: ${heap}MB | PAYLOAD_SIZE: ${payload.length}b | QUERY: ${query.substring(0, 80).replace(/\n/g, " ")}...`,
    );

    if (res.status === 429) {
      if (attempts > 7) throw new Error("Max retries exceeded for GraphQL API.");
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      const backoffMs = Math.max(retryAfter * 1000, Math.pow(2, attempts) * 1000);
      await new Promise((r) => setTimeout(r, backoffMs));
      return graphql(query, variables, attempts + 1);
    }

    if (res.status >= 500 && res.status < 600) {
      if (attempts > 5) throw new Error(`Shopify Server Error ${res.status} after retries.`);
      await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000));
      return graphql(query, variables, attempts + 1);
    }

    if (!res.ok) {
      throw new Error(`Shopify GraphQL ${res.status}: ${rawText.slice(0, 200)}`);
    }

    // Enterprise Cost-Tracking & Backpressure
    if (json.extensions?.cost?.throttleStatus) {
      const { currentlyAvailable, restoreRate } = json.extensions.cost.throttleStatus;
      if (currentlyAvailable < 100) {
        const waitMs = Math.ceil(((100 - currentlyAvailable) / restoreRate) * 1000);
        await new Promise((r) => setTimeout(r, Math.max(waitMs, 1000)));
      }
    }

    if (json.errors && json.errors.length > 0) {
      const isThrottled = json.errors.some(
        (e: any) => e.extensions?.code === "THROTTLED" || e.message.includes("throttled"),
      );
      if (isThrottled && attempts < 7) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000 + Math.random() * 500)); // Exponential backoff with jitter
        return graphql(query, variables, attempts + 1);
      }
      throw new Error(`Shopify GraphQL Error: ${JSON.stringify(json.errors)}`);
    }

    return json.data as T;
  }

  async function paginateGraphQL<T = unknown>(
    queryBuilder: (cursor: string | null) => string,
    extractPath: string[],
  ): Promise<T[]> {
    const allItems: T[] = [];
    let hasNext = true;
    let cursor: string | null = null;

    while (hasNext) {
      const q = queryBuilder(cursor);
      const res: any = await graphql<any>(q).catch(() => null);

      let root = res;
      for (const p of extractPath) {
        if (!root) break;
        root = root[p];
      }

      if (!root || !root.edges) break;

      const items = root.edges.map((e: any) => e.node);
      allItems.push(...items);

      hasNext = !!root.pageInfo?.hasNextPage;
      cursor = root.pageInfo?.endCursor || null;
    }

    return allItems;
  }

  return { domain, rest, paged, pagedCount, graphql, paginateGraphQL };
}

export interface ShopInfo {
  name: string;
  domain: string;
  plan_name?: string;
  plan_display_name?: string;
  country_name?: string;
  currency?: string;
  email?: string;
  myshopify_domain?: string;
  primary_locale?: string;
}

export async function fetchShopInfo(client: ShopifyClient): Promise<ShopInfo> {
  const { shop } = await client.rest<{ shop: ShopInfo }>("/shop.json");
  return shop;
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  let hasError = false;

  const worker = async () => {
    while (index < items.length && !hasError) {
      const i = index++;
      try {
        results[i] = await fn(items[i]);
      } catch (err) {
        hasError = true;
        throw err;
      }
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
