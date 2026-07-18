import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";

// The module reads SHOPIFY_API_SECRET at import time, so set it before importing.
const SECRET = "shpss_test_secret_for_vitest";
process.env.SHOPIFY_API_SECRET = SECRET;

let verifyWebhookHmac: (body: string, hmac: string | null) => boolean;
let handleShopifyWebhooks: (req: Request) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("../shopify-webhooks.server");
  verifyWebhookHmac = mod.verifyWebhookHmac;
  handleShopifyWebhooks = mod.handleShopifyWebhooks;
});

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
}

function webhookRequest(body: string, hmac: string | null, topic: string): Request {
  return new Request("https://app.example/api/webhooks", {
    method: "POST",
    headers: {
      "x-shopify-hmac-sha256": hmac ?? "",
      "x-shopify-topic": topic,
      "x-shopify-shop-domain": "proof-store.myshopify.com",
      "content-type": "application/json",
    },
    body,
  });
}

describe("verifyWebhookHmac", () => {
  it("accepts a correct signature over the raw body", () => {
    const body = JSON.stringify({ id: 1 });
    expect(verifyWebhookHmac(body, sign(body))).toBe(true);
  });

  it("rejects when the body is altered", () => {
    const body = JSON.stringify({ id: 1 });
    expect(verifyWebhookHmac(body + " ", sign(body))).toBe(false);
  });

  it("rejects a null/empty signature", () => {
    expect(verifyWebhookHmac("{}", null)).toBe(false);
    expect(verifyWebhookHmac("{}", "")).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    expect(verifyWebhookHmac("{}", "AAAA")).toBe(false);
  });
});

describe("handleShopifyWebhooks", () => {
  it("returns 200 for a valid signature on a no-op topic", async () => {
    const body = JSON.stringify({ shop_id: 42 });
    const res = await handleShopifyWebhooks(
      webhookRequest(body, sign(body), "customers/data_request"),
    );
    expect(res.status).toBe(200);
  });

  it("returns 401 for a tampered signature", async () => {
    const body = JSON.stringify({ shop_id: 42 });
    const bad = Buffer.from(sign(body), "base64");
    bad[0] ^= 0x01;
    const res = await handleShopifyWebhooks(
      webhookRequest(body, bad.toString("base64"), "customers/data_request"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when the signature header is missing", async () => {
    const res = await handleShopifyWebhooks(webhookRequest("{}", null, "app/uninstalled"));
    expect(res.status).toBe(401);
  });
});
