import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";

const API_KEY = "test_api_key_123";
const API_SECRET = "test_api_secret_456";
process.env.SHOPIFY_API_KEY = API_KEY;
process.env.SHOPIFY_API_SECRET = API_SECRET;
process.env.SHOPIFY_APP_URL = "https://app.example.com";

let mod: typeof import("../shopify-oauth.server");

beforeAll(async () => {
  mod = await import("../shopify-oauth.server");
});

describe("shop domain validation", () => {
  it("accepts a real myshopify domain", () => {
    expect(mod.isValidShopDomain("atlas-supply.myshopify.com")).toBe(true);
  });
  it("rejects arbitrary/injection domains", () => {
    expect(mod.isValidShopDomain("evil.com")).toBe(false);
    expect(mod.isValidShopDomain("atlas.myshopify.com.evil.com")).toBe(false);
    expect(mod.isValidShopDomain("javascript:alert(1)")).toBe(false);
  });
  it("normalizes shorthand and URLs", () => {
    expect(mod.normalizeShop("Atlas-Supply")).toBe("atlas-supply.myshopify.com");
    expect(mod.normalizeShop("https://atlas.myshopify.com/admin")).toBe("atlas.myshopify.com");
  });
});

describe("buildAuthorizeUrl", () => {
  it("builds an offline-token authorize URL with all required params", () => {
    const url = new URL(mod.buildAuthorizeUrl("atlas.myshopify.com", "state123"));
    expect(url.origin).toBe("https://atlas.myshopify.com");
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe(API_KEY);
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/auth/callback");
    expect(url.searchParams.get("state")).toBe("state123");
    expect(url.searchParams.get("grant_options[]")).toBe(""); // offline
    expect(url.searchParams.get("scope")).toContain("write_products");
  });
});

describe("verifyCallbackHmac", () => {
  function signed(params: Record<string, string>): URLSearchParams {
    const entries = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("&");
    const hmac = createHmac("sha256", API_SECRET).update(entries).digest("hex");
    return new URLSearchParams({ ...params, hmac });
  }

  it("accepts a correctly signed callback", () => {
    const p = signed({ code: "abc", shop: "atlas.myshopify.com", state: "s1", timestamp: "1700" });
    expect(mod.verifyCallbackHmac(p)).toBe(true);
  });

  it("rejects a tampered parameter", () => {
    const p = signed({ code: "abc", shop: "atlas.myshopify.com", state: "s1", timestamp: "1700" });
    p.set("code", "abc-tampered");
    expect(mod.verifyCallbackHmac(p)).toBe(false);
  });

  it("rejects a missing hmac", () => {
    const p = new URLSearchParams({ code: "abc", shop: "atlas.myshopify.com" });
    expect(mod.verifyCallbackHmac(p)).toBe(false);
  });
});
