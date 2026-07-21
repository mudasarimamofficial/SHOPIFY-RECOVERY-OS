import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";

function key() {
  const raw = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || "12345678901234567890123456789012";
  return createHash("sha256").update(raw).digest();
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

try {
  console.log("Token 1:", decryptToken("iMcDkkSq+RbvEQyaIPrgxfpTrVgyrjC06oYY6hLMpX9GwPMCcBKkZdQ="));
} catch (e) {
  console.log("Failed 1:", e);
}

try {
  console.log(
    "Token 2:",
    decryptToken(
      "e7VlorbqiISsmytPLLjQ1l6LNm0vSBAmsvEjrMGSQV1S4RFAi+ukDbu02IbGfLFdZ3YW+FBP2fvgkvN/gMhGknNm",
    ),
  );
} catch (e) {
  console.log("Failed 2:", e);
}
