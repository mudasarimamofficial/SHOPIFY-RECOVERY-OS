import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createHash, createDecipheriv } from "node:crypto";

config({ path: ".env.production" });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enc = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;

if (!url || !key || !enc) {
  console.error("Missing env vars in .env.production");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function decrypt(ciphertext: string) {
  const raw = Buffer.from(ciphertext, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256")
      .update(enc as string)
      .digest(),
    raw.subarray(0, 12),
  );
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

async function run() {
  const { data: stores, error } = await supabase.from("stores").select("*").order("created_at");
  if (error) {
    console.error(error);
    return;
  }
  for (const s of stores) {
    console.log(`ID: ${s.id}`);
    console.log(`Domain: ${s.shop_domain}`);
    console.log(`Token: ${decrypt(s.access_token_ciphertext)}`);
    console.log(`Scopes: ${s.scopes.join(",")}`);
    console.log("-----------------------------------------");
  }
}
run();
