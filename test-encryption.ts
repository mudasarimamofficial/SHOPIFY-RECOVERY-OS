process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "12345678901234567890123456789012";
import { encryptToken, decryptToken } from "./src/lib/shopify.server";

async function test() {
  console.log("=== ENCRYPTION SUBSYSTEM TEST ===");
  const testToken = "shpua_1234567890abcdef1234567890abcdef";
  console.log("Original Token:", testToken);

  const encrypted = encryptToken(testToken);
  console.log("Encrypted:", encrypted);

  const decrypted = decryptToken(encrypted);
  console.log("Decrypted:", decrypted);

  if (decrypted === testToken) {
    console.log("STATUS: PASS");
  } else {
    console.log("STATUS: FAIL");
    process.exit(1);
  }
}

test().catch(console.error);
