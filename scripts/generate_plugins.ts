import fs from "fs";
import path from "path";

const plugins = [
  "variants",
  "smart_collections",
  "custom_collections",
  "customers",
  "orders",
  "draft_orders",
  "pages",
  "blogs",
  "articles",
  "menus",
  "navigation",
  "files",
  "media",
  "themes",
  "theme_assets",
  "templates",
  "sections",
  "snippets",
  "locales",
  "theme_settings",
  "policies",
  "markets",
  "locations",
  "inventory",
  "inventory_levels",
  "metafields",
  "metaobject_definitions",
  "metaobject_entries",
  "metaobject_references",
  "selling_plans",
  "discounts",
  "automatic_discounts",
  "shipping_profiles",
  "shipping_zones",
  "taxes",
  "translations",
  "redirects",
  "seo",
  "store_settings",
  "brand_settings",
  "functions",
  "scripts",
  "webhooks",
  "app_blocks",
  "theme_app_extensions",
];

const template = (
  name: string,
  className: string,
) => `import { BaseBulkPlugin } from "./base-plugin";

export class ${className}Plugin extends BaseBulkPlugin {
  type = "${name}";
  dependencies = [];

  getBulkQuery(): string {
    return \`
      {
        \${this.type} {
          edges {
            node {
              id
            }
          }
        }
      }
    \`;
  }

  getRestoreMutation(): string {
    const singleName = this.type.replace(/s$/, "");
    return \`
      mutation \${singleName}Create($input: \${singleName.charAt(0).toUpperCase() + singleName.slice(1)}Input!) {
        \${singleName}Create(input: $input) {
          \${singleName} { id }
          userErrors { field message }
        }
      }
    \`;
  }
}
`;

const dir = path.join(process.cwd(), "src/lib/pipeline/plugins");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

for (const p of plugins) {
  if (p === "products" || p === "collections") continue;

  const className = p
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  const file = path.join(dir, `${p}.ts`);
  fs.writeFileSync(file, template(p, className));
}
console.log(`Successfully generated ${plugins.length} BaseBulk plugins.`);
