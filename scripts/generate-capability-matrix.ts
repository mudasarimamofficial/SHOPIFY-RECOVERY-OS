import fs from "fs";
import path from "path";
import { RESOURCE_CATALOG } from "../src/lib/resource-catalog";

const OUTPUT_PATH = path.join(
  process.cwd(),
  "PROJECT_MEMORY",
  "08_ACCEPTANCE",
  "Resource_Capability_Matrix.md",
);

function generateMatrix() {
  let md = `# Resource Capability Matrix\n\n`;
  md += `This matrix is automatically generated to track the exact technical capabilities, limitations, and APIs used for every Shopify resource in the Imam Migration OS pipeline.\n\n`;

  md += `| Resource | Group | Backed Up? | Restored? | API Used | Scopes Required | Limitations |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  for (const r of RESOURCE_CATALOG) {
    const backedUp = r.scanned ? "✅ Yes" : "❌ No";
    let restored = "❌ No";
    if (r.recoverability === "full") restored = r.scanned ? "✅ Full" : "❌ No";
    if (r.recoverability === "partial") restored = r.scanned ? "⚠️ Partial" : "❌ No";
    if (r.recoverability === "manual") restored = "🧑‍💻 Manual";
    if (r.recoverability === "unavail") restored = "⛔ API Locked";

    let apiUsed = "N/A";
    let scopes = "N/A";
    let limitations = r.note || "None identified.";

    // Hardcoded logic extraction based on backup.server.ts and executor.ts
    if (r.key === "products" || r.key === "products_bulk") {
      apiUsed = "GraphQL Bulk + `productSet`";
      scopes = "`write_products`, `read_products`, `write_inventory`";
    } else if (r.key === "customers" || r.key === "customers_bulk") {
      apiUsed = "GraphQL Bulk + `customerCreate`";
      scopes = "`write_customers`, `read_customers`";
    } else if (r.key === "orders" || r.key === "orders_bulk") {
      apiUsed = "GraphQL Bulk + REST POST";
      scopes = "`write_orders`, `read_orders`";
      limitations =
        "API LIMITATION: Historical orders use REST `POST /orders.json` for import. Partial restoration. Shopify does not allow recreating exact historic GraphQL objects.";
    } else if (r.key === "collections" || r.key === "collections_bulk") {
      apiUsed = "GraphQL Bulk + `collectionCreate`";
      scopes = "`write_products`";
    } else if (r.key === "theme") {
      apiUsed = "REST Concurrent GET/PUT";
      scopes = "`write_themes`";
    } else if (r.scanned) {
      apiUsed = "REST `paged` + REST PUT/POST";
      scopes = "Varies by resource";
    }

    if (r.recoverability === "unavail") {
      limitations = `SHOPIFY LIMITATION: ${limitations}`;
    } else if (r.recoverability === "partial" && !limitations.includes("LIMITATION")) {
      limitations = `ARCHITECTURAL LIMITATION: ${limitations}`;
    }

    md += `| **${r.label}** (\`${r.key}\`) | ${r.group} | ${backedUp} | ${restored} | ${apiUsed} | ${scopes} | ${limitations} |\n`;
  }

  md += `\n\n_Generated on ${new Date().toISOString()}_\n`;

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, md, "utf-8");
  console.log(`Resource Capability Matrix written to ${OUTPUT_PATH}`);
}

generateMatrix();
