import { describe, it, expect } from "vitest";

// Token encryption (shopify.server.ts) derives a 32-byte key via sha256, so it
// accepts any non-empty key string. Set one before importing.
process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "unit-test-token-key";

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips a token and produces a fresh IV each time", async () => {
    const { encryptToken, decryptToken } = await import("../shopify.server");
    const token = "shpat_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const a = encryptToken(token);
    const b = encryptToken(token);
    expect(decryptToken(a)).toBe(token);
    expect(a).not.toBe(b); // random IV per encryption
  });

  it("rejects tampered ciphertext via the GCM auth tag", async () => {
    const { encryptToken, decryptToken } = await import("../shopify.server");
    const buf = Buffer.from(encryptToken("shpat_secret"), "base64");
    buf[buf.length - 1] ^= 0x01;
    expect(() => decryptToken(buf.toString("base64"))).toThrow();
  });
});

describe("recovery-package encryption key (fail-closed)", () => {
  it("throws when ENCRYPTION_KEY is missing (no default key)", async () => {
    delete process.env.ENCRYPTION_KEY;
    const { EncryptTransform } = await import("../sdk/recovery/streams");
    expect(() => new EncryptTransform()).toThrow(/ENCRYPTION_KEY is not configured/);
  });

  it("throws when ENCRYPTION_KEY is not 32 bytes", async () => {
    process.env.ENCRYPTION_KEY = "abcd";
    const { EncryptTransform } = await import("../sdk/recovery/streams");
    expect(() => new EncryptTransform()).toThrow(/must be 32 bytes/);
  });
});
