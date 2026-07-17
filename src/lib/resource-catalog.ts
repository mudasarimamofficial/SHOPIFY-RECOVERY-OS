// Resource catalogue for scanner UI + backup engine.
// Recoverability tiers:
//  - full      : automatically restored to a target store
//  - partial   : metadata only or subject to Shopify restrictions
//  - manual    : requires manual reconnect / re-auth outside Shopify
//  - unavail   : not accessible via Admin API
export type Recoverability = "full" | "partial" | "manual" | "unavail";

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
  { key: "files", label: "Files (images, video, docs)", group: "Content", recoverability: "full" },

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
  },
  { key: "metaobjects", label: "Metaobjects", group: "Metafields", recoverability: "full" },

  // Commerce config
  {
    key: "discounts",
    label: "Discount codes & automatic",
    group: "Commerce",
    recoverability: "full",
  },
  {
    key: "shipping",
    label: "Shipping profiles & zones",
    group: "Commerce",
    recoverability: "full",
  },
  { key: "markets", label: "Markets configuration", group: "Commerce", recoverability: "full" },
  {
    key: "translations",
    label: "Translations & locales",
    group: "Commerce",
    recoverability: "full",
  },
  { key: "selling_plans", label: "Selling plans", group: "Commerce", recoverability: "full" },

  // Store settings
  {
    key: "shop",
    label: "Shop settings & brand",
    group: "Settings",
    recoverability: "full",
    scanned: true,
  },
  { key: "webhooks", label: "Webhooks", group: "Settings", recoverability: "full" },

  // Manual reconnect
  {
    key: "payments",
    label: "Payment providers (Shopify Payments, Stripe, PayPal)",
    group: "External",
    recoverability: "manual",
  },
  { key: "domains", label: "Custom domains & DNS", group: "External", recoverability: "manual" },
  { key: "pixels", label: "Meta Pixel ownership", group: "External", recoverability: "manual" },
  {
    key: "google_analytics",
    label: "Google Analytics / Merchant Center",
    group: "External",
    recoverability: "manual",
  },
  {
    key: "email_auth",
    label: "Email SPF / DKIM / DMARC",
    group: "External",
    recoverability: "manual",
  },
  {
    key: "third_party_apps",
    label: "Third-party app subscriptions & data",
    group: "External",
    recoverability: "manual",
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
