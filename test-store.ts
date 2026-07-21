import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.vercel" });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const algorithm = "aes-256-gcm";
const rawKey = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || "fallback_key_32_bytes_long_exact!";
const key = crypto.scryptSync(rawKey, "salt", 32);

function decryptToken(encryptedString: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedString.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error("Invalid encrypted format");
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function run() {
  const { data: stores, error } = await supabase.from("stores").select("*");
  if (error) {
    console.error("DB Error:", error);
    process.exit(1);
  }

  if (!stores || stores.length === 0) {
    console.error(
      "No stores found in DB! Installation did not complete successfully or DB write failed.",
    );
    process.exit(1);
  }

  // Filter out the test store if it's there
  const validStores = stores.filter((s) => s.shop_domain !== "test-pipeline-store.myshopify.com");
  if (validStores.length === 0) {
    console.error("Only test store found! The actual installation hasn't been completed.");
    process.exit(1);
  }

  const store = validStores[0];
  console.log("Found store:", store.shop_domain);
  console.log("Token Ciphertext:", store.access_token_ciphertext.substring(0, 30) + "...");

  try {
    const decryptedToken = decryptToken(store.access_token_ciphertext);
    console.log("Token successfully decrypted! Length:", decryptedToken.length);

    // GraphQL Test
    const gqlUrl = `https://${store.shop_domain}/admin/api/2024-01/graphql.json`;
    const res = await fetch(gqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": decryptedToken,
      },
      body: JSON.stringify({
        query: "{ shop { name id } }",
      }),
    });
    const json = await res.json();
    console.log("GraphQL Response:", JSON.stringify(json));
  } catch (err: any) {
    console.error("Verification failed:", err.message);
  }
}

run();
