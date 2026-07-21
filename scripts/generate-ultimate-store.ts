import { createClient } from "@supabase/supabase-js";
import { makeShopifyClient, decryptToken } from "../src/lib/shopify.server";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const domain = process.argv[2];
  const token = process.argv[3];

  if (!domain || !token) {
    console.error("Usage: bun run scripts/generate-ultimate-store.ts <shop_domain> <shpat_token>");
    process.exit(1);
  }

  console.log(`Using Store A: ${domain}`);
  const client = makeShopifyClient(domain, token);

  // 1. Create a 100-variant product (Edge Case)
  console.log("Generating 100-variant product...");
  const hundredVariants = Array.from({ length: 100 }).map((_, i) => ({
    price: `${(i + 1) * 1.5}`,
    sku: `ULTIMATE-100-${i}`,
    optionValues: [{ optionName: "Variant Number", name: `Variant ${i}` }],
  }));

  const res100 = await client.graphql<any>(
    `
    mutation productSet($input: ProductSetInput!) {
      productSet(input: $input) {
        product { id }
        userErrors { field message }
      }
    }
  `,
    {
      input: {
        title: "Ultimate 100 Variant Edge Case",
        descriptionHtml:
          "<p>This is a test product with exactly 100 variants to test pagination.</p>",
        productOptions: [
          {
            name: "Variant Number",
            values: Array.from({ length: 100 }).map((_, i) => ({ name: `Variant ${i}` })),
          },
        ],
        variants: hundredVariants,
      },
    },
  );

  if (res100.productSet?.userErrors?.length > 0) {
    console.error("Error creating 100-variant product:", res100.productSet.userErrors);
  } else {
    console.log(`Created 100-variant product: ${res100.productSet?.product?.id}`);
  }

  // 2. Create Draft Product
  console.log("Generating Draft product...");
  await client.graphql<any>(
    `
    mutation productSet($input: ProductSetInput!) {
      productSet(input: $input) { product { id } }
    }
  `,
    { input: { title: "Invisible Draft Product", status: "DRAFT" } },
  );

  // 3. Create Smart Collection
  console.log("Generating Smart Collection...");
  await client.graphql<any>(
    `
    mutation collectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) { collection { id } }
    }
  `,
    {
      input: {
        title: "Ultimate Smart Collection",
        ruleSet: {
          appliedDisjunctively: false,
          rules: [{ column: "TITLE", relation: "CONTAINS", condition: "Ultimate" }],
        },
      },
    },
  );

  // 4. Create Customers
  console.log("Generating Customers...");
  for (let i = 0; i < 5; i++) {
    await client.graphql<any>(
      `
      mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) { customer { id } }
      }
    `,
      {
        input: {
          firstName: `EdgeCase`,
          lastName: `Customer ${i}`,
          email: `edgecase${i}@imamrecovery.os`,
          tags: ["VIP", "TEST"],
        },
      },
    );
  }

  console.log("Ultimate Test Store generation complete.");
}

main().catch(console.error);
