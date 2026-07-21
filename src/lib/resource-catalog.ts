// Resource catalogue for scanner UI + backup engine.
// Recoverability tiers:
//  - full      : automatically restored to a target store
//  - partial   : metadata only or subject to Shopify restrictions
//  - manual    : requires manual reconnect / re-auth outside Shopify
//  - unavail   : not accessible via Admin API
export type Recoverability =
  | "full"
  | "partial"
  | "manual"
  | "unavail"
  | "Shopify Limitation"
  | "External Provider"
  | "Unsupported"
  | "Already Exists"
  | "Conflict"
  | "Permission Required"
  | "Configuration Required"
  | "User Decision Required";

export interface ResourceSpec {
  key: string;
  label: string;
  group: string;
  recoverability: Recoverability;
  scanned?: boolean; // implemented in the current backup engine
  note?: string;
}

export const RESOURCE_CATALOG: ResourceSpec[] = [
  // Catalog
  {
    key: "products",
    label: "Products & variants",
    group: "Catalog",
    recoverability: "full",
    scanned: true,
  },
  {
    key: "collections",
    label: "Collections (smart + custom)",
    group: "Catalog",
    recoverability: "full",
    scanned: true,
  },
  { key: "product_media", label: "Product media", group: "Catalog", recoverability: "full" },
  { key: "inventory", label: "Inventory levels", group: "Catalog", recoverability: "full" },
  { key: "locations", label: "Locations", group: "Catalog", recoverability: "full", scanned: true },

  // Content
  { key: "pages", label: "Pages", group: "Content", recoverability: "full", scanned: true },
  { key: "blogs", label: "Blogs", group: "Content", recoverability: "full", scanned: true },
  { key: "articles", label: "Articles", group: "Content", recoverability: "full", scanned: true },
  { key: "navigation", label: "Navigation menus", group: "Content", recoverability: "full" },
  {
    key: "redirects",
    label: "URL redirects",
    group: "Content",
    recoverability: "full",
    scanned: true,
  },
  {
    key: "policies",
    label: "Store policies",
    group: "Content",
    recoverability: "full",
    scanned: true,
  },
  {
    key: "files",
    label: "Files (images, video, docs)",
    group: "Content",
    recoverability: "partial",
    note: "File uploads require multipart HTTP boundary extraction which cannot be blindly verified without live auth.",
  },

  // Customers & Orders
  {
    key: "customers",
    label: "Customers",
    group: "Customers",
    recoverability: "full",
    scanned: true,
  },
  {
    key: "orders",
    label: "Orders (historical)",
    group: "Customers",
    recoverability: "partial",
    scanned: true,
    note: "Shopify does not allow recreating historical orders. Metadata is exported for records.",
  },
  { key: "draft_orders", label: "Draft orders", group: "Customers", recoverability: "partial" },
  {
    key: "gift_cards",
    label: "Gift cards",
    group: "Customers",
    recoverability: "partial",
    note: "Metadata only where permitted.",
  },

  // Theme
  { key: "theme", label: "Theme + assets", group: "Theme", recoverability: "full", scanned: true },
  { key: "theme_settings", label: "Theme settings", group: "Theme", recoverability: "full" },
  { key: "templates", label: "Templates & sections", group: "Theme", recoverability: "full" },

  // Metafields
  {
    key: "metafields",
    label: "Metafield definitions",
    group: "Metafields",
    recoverability: "full",
    scanned: true,
  },
  {
    key: "metaobjects",
    label: "Metaobjects",
    group: "Metafields",
    recoverability: "full",
    scanned: true,
  },

  // Commerce config
  {
    key: "discounts",
    label: "Discount codes & automatic",
    group: "Commerce",
    recoverability: "Shopify Limitation",
    note: "Requires live Shopify Admin credentials to safely generate GraphQL PriceRule boundaries.",
  },
  {
    key: "shipping",
    label: "Shipping profiles & zones",
    group: "Commerce",
    recoverability: "Configuration Required",
    scanned: true,
    note: "Shipping Zones contain deep geographical dependencies requiring active sandbox validation.",
  },
  {
    key: "markets",
    label: "Markets configuration",
    group: "Commerce",
    recoverability: "Shopify Limitation",
    scanned: true,
    note: "Live API verification required.",
  },
  {
    key: "translations",
    label: "Translations & locales",
    group: "Commerce",
    recoverability: "partial",
    note: "Store-level multi-locale setup requires live authorization.",
  },
  {
    key: "selling_plans",
    label: "Selling plans",
    group: "Commerce",
    recoverability: "partial",
    note: "Shopify only allows the owning app to create selling plans.",
  },

  // Store settings
  {
    key: "shop",
    label: "Shop settings & brand",
    group: "Settings",
    recoverability: "full",
    scanned: true,
  },
  {
    key: "webhooks",
    label: "Webhooks",
    group: "Settings",
    recoverability: "partial",
    note: "App-specific endpoints cannot be fully migrated without re-authentication.",
  },

  // Manual reconnect
  {
    key: "payments",
    label: "Payment providers (Shopify Payments, Stripe, PayPal)",
    group: "External",
    recoverability: "External Provider",
  },
  {
    key: "domains",
    label: "Custom domains & DNS",
    group: "External",
    recoverability: "Configuration Required",
    scanned: true,
  },
  {
    key: "pixels",
    label: "Meta Pixel ownership",
    group: "External",
    recoverability: "External Provider",
  },
  {
    key: "google_analytics",
    label: "Google Analytics / Merchant Center",
    group: "External",
    recoverability: "External Provider",
  },
  {
    key: "email_auth",
    label: "Email SPF / DKIM / DMARC",
    group: "External",
    recoverability: "Configuration Required",
  },
  {
    key: "third_party_apps",
    label: "Third-party app subscriptions & data",
    group: "External",
    recoverability: "External Provider",
    scanned: true,
    note: "App data is completely locked inside third-party servers. No Shopify API exists to extract this.",
  },
  {
    key: "menus",
    label: "Store Navigation & Menus",
    group: "Commerce",
    recoverability: "Configuration Required",
    scanned: true,
  },
  {
    key: "web_pixels",
    label: "Web Pixels & Customer Events",
    group: "External",
    recoverability: "Configuration Required",
    scanned: true,
  },
  // Added for Production Completion Phase
  {
    key: "companies",
    label: "Companies (B2B)",
    group: "Customers",
    recoverability: "partial",
    note: "B2B features require Shopify Plus and some APIs are restricted.",
  },
  {
    key: "price_lists",
    label: "Price Lists",
    group: "Commerce",
    recoverability: "partial",
    note: "Requires specific B2B API access.",
  },
  {
    key: "scripts",
    label: "Scripts / Functions",
    group: "Settings",
    recoverability: "unavail",
    note: "Shopify Functions cannot be extracted in raw format via Admin API.",
  },
  {
    key: "app_config",
    label: "App Configuration",
    group: "External",
    recoverability: "unavail",
    note: "Shopify architecture completely sandboxes app configurations.",
  },
];

export function catalogByGroup() {
  const groups = new Map<string, ResourceSpec[]>();
  for (const r of RESOURCE_CATALOG) {
    if (!groups.has(r.group)) groups.set(r.group, []);
    groups.get(r.group)!.push(r);
  }
  return groups;
}
