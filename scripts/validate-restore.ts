import { createClient } from "@supabase/supabase-js";
import { makeShopifyClient, decryptToken } from "../src/lib/shopify.server";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

async function validateRestore() {
  console.log("=== IMAM RECOVERY OS VALIDATION ENGINE ===");
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Example inputs (replace with actual IDs or pass via argv)
  const backupId = process.argv[2];
  const targetStoreId = process.argv[3];

  if (!backupId || !targetStoreId) {
    console.error("Usage: bun run scripts/validate-restore.ts <backup_id> <target_store_id>");
    process.exit(1);
  }

  const { data: backup, error: backupErr } = await supabase
    .from("backups")
    .select("manifest")
    .eq("id", backupId)
    .single();

  if (backupErr || !backup) throw new Error("Backup not found");

  const manifest = backup.manifest as any;
  const catalog = manifest.catalog || [];

  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("shop_domain, access_token_ciphertext")
    .eq("id", targetStoreId)
    .single();

  if (storeErr || !store) throw new Error("Store not found");

  const token = decryptToken(store.access_token_ciphertext);
  const client = makeShopifyClient(store.shop_domain, token);

  console.log(`\nValidating Target Store: ${store.shop_domain}`);
  console.log("------------------------------------------------");

  let allMatch = true;

  for (const item of catalog) {
    if (item.count === 0) continue;

    let liveCount = 0;
    try {
      if (item.key.includes("products")) {
        liveCount = await client.pagedCount("/products.json?fields=id", "products");
      } else if (item.key.includes("customers")) {
        liveCount = await client.pagedCount("/customers.json?fields=id", "customers");
      } else if (item.key.includes("collections")) {
        const custom = await client.pagedCount(
          "/custom_collections.json?fields=id",
          "custom_collections",
        );
        const smart = await client.pagedCount(
          "/smart_collections.json?fields=id",
          "smart_collections",
        );
        liveCount = custom + smart;
      } else if (item.key === "pages") {
        liveCount = await client.pagedCount("/pages.json?fields=id", "pages");
      } else if (item.key === "blogs") {
        liveCount = await client.pagedCount("/blogs.json?fields=id", "blogs");
      } else if (item.key === "articles") {
        // Articles require querying per blog
        const blogs = await client.paged<{ id: number }>("/blogs.json?fields=id", "blogs");
        for (const b of blogs) {
          liveCount += await client.pagedCount(
            `/blogs/${b.id}/articles.json?fields=id`,
            "articles",
          );
        }
      } else if (item.key === "redirects") {
        liveCount = await client.pagedCount("/redirects.json?fields=id", "redirects");
      } else {
        console.log(
          `Skipping exact count validation for ${item.key} (Source count: ${item.count})`,
        );
        continue;
      }

      const match = liveCount === item.count;
      if (!match) allMatch = false;

      console.log(
        `[${match ? "PASS" : "FAIL"}] ${item.key.padEnd(20)} | Source: ${item.count} | Target: ${liveCount}`,
      );
    } catch (e: any) {
      console.log(`[ERROR] ${item.key.padEnd(19)} | Could not fetch target count: ${e.message}`);
      allMatch = false;
    }
  }

  console.log("------------------------------------------------");
  if (allMatch) {
    console.log("✅ DATA INTEGRITY VERIFIED. Store B matches Backup Package counts.");
  } else {
    console.log("❌ DISCREPANCY DETECTED. See above for mismatches.");
  }
}

validateRestore().catch(console.error);
