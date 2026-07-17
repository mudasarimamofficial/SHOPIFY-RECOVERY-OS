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
  graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
}

export function makeShopifyClient(domain: string, token: string): ShopifyClient {
  const base = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}`;
  async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
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
      await new Promise((r) => setTimeout(r, 2000));
      return rest(path, init);
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
    let safety = 40;
    while (safety-- > 0) {
      const res = await fetch(base + url, {
        headers: {
          "X-Shopify-Access-Token": token,
          Accept: "application/json",
        },
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Shopify ${res.status} on ${url}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as Record<string, T[]>;
      const items = data[key] ?? [];
      out.push(...items);
      const link = res.headers.get("link") ?? "";
      const next = link.match(/<([^>]+)>;\s*rel="next"/);
      if (!next || items.length === 0) break;
      const u = new URL(next[1]);
      url = u.pathname.replace(/^\/admin\/api\/[^/]+/, "") + u.search;
    }
    return out;
  }
  async function graphql<T>(query: string, variables?: Record<string, unknown>, attempts = 0): Promise<T> {
    const res = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return graphql(query, variables, attempts + 1);
    }
    
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Shopify GraphQL ${res.status}: ${body.slice(0, 200)}`);
    }
    
    const json = (await res.json()) as { data?: T; errors?: any[]; extensions?: any };
    
    // Enterprise Cost-Tracking & Backpressure
    if (json.extensions?.cost?.throttleStatus) {
      const { currentlyAvailable, restoreRate } = json.extensions.cost.throttleStatus;
      // If we are dangerously low on GraphQL capacity, pause execution to allow the leaky bucket to refill.
      if (currentlyAvailable < 100) {
        // Wait long enough to restore ~100 points
        const waitMs = Math.ceil((100 / restoreRate) * 1000);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    
    if (json.errors && json.errors.length > 0) {
      // Handle throttling errors explicitly
      const isThrottled = json.errors.some((e: any) => e.extensions?.code === "THROTTLED");
      if (isThrottled && attempts < 5) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 1000)); // Exponential backoff
        return graphql(query, variables, attempts + 1);
      }
      throw new Error(`Shopify GraphQL Error: ${JSON.stringify(json.errors)}`);
    }
    
    return json.data as T;
  }
  return { domain, rest, paged, graphql };
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
