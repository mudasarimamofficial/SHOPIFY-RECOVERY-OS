import { createClient } from "@supabase/supabase-js";
import { makeShopifyClient, decryptToken } from "../src/lib/shopify.server";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

async function auditStoreB() {
  console.log("=== AUDITING STORE B CUSTOM APP ===");

  const token = process.argv[2];
  const shopDomain = process.argv[3] || "lila-melbourne-deqn1tu1.myshopify.com";

  if (!token) {
    console.error("Usage: bun run scripts/audit-store-b.ts <shpat_token> [shop_domain]");
    process.exit(1);
  }

  console.log(`Found store: ${shopDomain}`);
  console.log("✅ Token provided via CLI.");

  const client = makeShopifyClient(store.shop_domain, token);

  console.log("\n--- Testing REST API (shop.json) ---");
  try {
    const { shop } = await client.rest<any>("/shop.json");
    console.log(`✅ REST API connected. Shop Name: ${shop.name}, Plan: ${shop.plan_display_name}`);
  } catch (e: any) {
    console.error("❌ REST API test failed:", e.message);
  }

  console.log("\n--- Testing GraphQL API ---");
  try {
    const gql = `query { shop { name primaryDomain { url } } }`;
    const res = await client.graphql<any>(gql);
    console.log(`✅ GraphQL API connected. Shop: ${res.shop.name}`);
  } catch (e: any) {
    console.error("❌ GraphQL API test failed:", e.message);
  }

  console.log("\n--- Auditing Access Scopes ---");
  try {
    const { access_scopes } = await client.rest<any>("/access_scopes.json");
    console.log("Granted Scopes:");
    const granted = access_scopes.map((s: any) => s.handle);
    granted.sort().forEach((s: string) => console.log(`  - ${s}`));

    // Check against required scopes
    const required = [
      "write_products",
      "read_products",
      "write_customers",
      "read_customers",
      "write_orders",
      "read_orders",
      "write_order_edits",
      "write_inventory",
      "read_inventory",
      "write_locations",
      "read_locations",
      "write_files",
      "read_files",
      "write_content",
      "read_content",
      "write_routing",
      "read_routing",
      "write_themes",
      "read_themes",
      "write_metaobjects",
      "read_metaobjects",
      "write_publications",
      "read_publications",
      "read_markets",
      "write_markets",
      "read_translations",
      "write_translations",
      "read_discounts",
      "write_discounts",
    ];

    console.log("\nScope Gap Analysis:");
    let missing = 0;
    for (const req of required) {
      if (!granted.includes(req)) {
        console.log(`❌ MISSING: ${req}`);
        missing++;
      } else {
        console.log(`✅ GRANTED: ${req}`);
      }
    }

    if (missing > 0) {
      console.log(`\n⚠️ Store B token is missing ${missing} required scopes.`);
    } else {
      console.log("\n✅ Store B token has all required scopes.");
    }
  } catch (e: any) {
    console.error("❌ Failed to fetch access scopes:", e.message);
  }
}

auditStoreB().catch(console.error);
