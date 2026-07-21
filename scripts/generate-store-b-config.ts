import * as fs from "fs";
import * as path from "path";

const SCOPES = [
  "read_products",
  "write_products",
  "read_customers",
  "write_customers",
  "read_orders",
  "write_orders",
  "read_inventory",
  "write_inventory",
  "read_locations",
  "read_fulfillments",
  "write_fulfillments",
  "read_shipping",
  "write_shipping",
  "read_draft_orders",
  "write_draft_orders",
  "read_discounts",
  "write_discounts",
  "read_price_rules",
  "write_price_rules",
  "read_themes",
  "write_themes",
  "read_content",
  "write_content", // Pages & Blogs
  "read_files",
  "write_files",
  "read_metaobjects",
  "write_metaobjects",
  "read_markets",
  "write_markets",
  "read_translations",
  "write_translations",
  "read_locales",
  "write_locales",
  "read_publications",
  "write_publications",
];

function generateStoreBConfig(productionUrl: string) {
  console.log("======================================================");
  console.log("          IMAM MIGRATION OS - STORE B CONFIG           ");
  console.log("======================================================");
  console.log(
    "\nShopify CLI cannot programmatically create a Partner App via the API without browser interaction.",
  );
  console.log(
    "To configure Store B (Destination) cleanly, go to your Shopify Partner Dashboard and create a new App.",
  );

  console.log("\n--- 1. APP NAME ---");
  console.log("Imam Migration OS Store B");

  console.log("\n--- 2. APP URLS ---");
  console.log(`App URL: ${productionUrl}`);
  console.log(`Allowed Redirection URL: ${productionUrl}/api/auth/callback`);

  console.log("\n--- 3. REQUIRED SCOPES ---");
  console.log(SCOPES.join(","));

  console.log("\n--- 4. WEBHOOKS (GDPR) ---");
  console.log(`Customer Data Request: ${productionUrl}/api/webhooks/customers/data_request`);
  console.log(`Customer Data Erasure: ${productionUrl}/api/webhooks/customers/redact`);
  console.log(`Shop Data Erasure:     ${productionUrl}/api/webhooks/shop/redact`);

  console.log("\n--- 5. ENVIRONMENT VARIABLES ---");
  console.log("Add the following to your Vercel Production Environment:");
  console.log("SHOPIFY_API_KEY_STORE_B=<Client_ID>");
  console.log("SHOPIFY_API_SECRET_STORE_B=<Client_Secret>");

  console.log("\n======================================================");

  const tomlContent = `name = "Imam Migration OS Store B"
client_id = "REPLACE_WITH_CLIENT_ID"
application_url = "${productionUrl}"
embedded = true

[build]
automatically_update_urls_on_dev = true
dev_store_url = "REPLACE_WITH_STORE_URL"

[access_scopes]
use_legacy_install_flow = true
scopes = "${SCOPES.join(",")}"

[auth]
redirect_urls = [
  "${productionUrl}/api/auth/callback"
]

[webhooks]
api_version = "2024-04"

[[webhooks.subscriptions]]
topics = [ "shop/redact" ]
uri = "${productionUrl}/api/webhooks/shop/redact"

[[webhooks.subscriptions]]
topics = [ "customers/redact" ]
uri = "${productionUrl}/api/webhooks/customers/redact"

[[webhooks.subscriptions]]
topics = [ "customers/data_request" ]
uri = "${productionUrl}/api/webhooks/customers/data_request"
`;

  fs.writeFileSync(path.join(process.cwd(), "shopify.store-b.toml"), tomlContent);
  console.log("\nAuto-generated shopify.store-b.toml in the root directory for your reference.");
}

// Read from current env or fallback
const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://shopify-recovery-ds3pwxk4g.vercel.app";

generateStoreBConfig(prodUrl);
