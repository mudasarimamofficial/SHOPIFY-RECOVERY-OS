# Resource Capability Matrix

This matrix is automatically generated to track the exact technical capabilities, limitations, and APIs used for every Shopify resource in the Imam Recovery OS pipeline.

| Resource | Group | Backed Up? | Restored? | API Used | Scopes Required | Limitations |
|---|---|---|---|---|---|---|
| **Products & variants** (`products`) | Catalog | ✅ Yes | ✅ Full | GraphQL Bulk + `productSet` | `write_products`, `read_products`, `write_inventory` | None identified. |
| **Collections (smart + custom)** (`collections`) | Catalog | ✅ Yes | ✅ Full | GraphQL Bulk + `collectionCreate` | `write_products` | None identified. |
| **Product media** (`product_media`) | Catalog | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Inventory levels** (`inventory`) | Catalog | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Locations** (`locations`) | Catalog | ✅ Yes | ✅ Full | REST `paged` + REST PUT/POST | Varies by resource | None identified. |
| **Pages** (`pages`) | Content | ✅ Yes | ✅ Full | REST `paged` + REST PUT/POST | Varies by resource | None identified. |
| **Blogs** (`blogs`) | Content | ✅ Yes | ✅ Full | REST `paged` + REST PUT/POST | Varies by resource | None identified. |
| **Articles** (`articles`) | Content | ✅ Yes | ✅ Full | REST `paged` + REST PUT/POST | Varies by resource | None identified. |
| **Navigation menus** (`navigation`) | Content | ❌ No | ❌ No | N/A | N/A | None identified. |
| **URL redirects** (`redirects`) | Content | ✅ Yes | ✅ Full | REST `paged` + REST PUT/POST | Varies by resource | None identified. |
| **Store policies** (`policies`) | Content | ✅ Yes | ✅ Full | REST `paged` + REST PUT/POST | Varies by resource | None identified. |
| **Files (images, video, docs)** (`files`) | Content | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Customers** (`customers`) | Customers | ✅ Yes | ✅ Full | GraphQL Bulk + `customerCreate` | `write_customers`, `read_customers` | None identified. |
| **Orders (historical)** (`orders`) | Customers | ✅ Yes | ⚠️ Partial | GraphQL Bulk + REST POST | `write_orders`, `read_orders` | API LIMITATION: Historical orders use REST `POST /orders.json` for import. Partial restoration. Shopify does not allow recreating exact historic GraphQL objects. |
| **Draft orders** (`draft_orders`) | Customers | ❌ No | ❌ No | N/A | N/A | ARCHITECTURAL LIMITATION: None identified. |
| **Gift cards** (`gift_cards`) | Customers | ❌ No | ❌ No | N/A | N/A | ARCHITECTURAL LIMITATION: Metadata only where permitted. |
| **Theme + assets** (`theme`) | Theme | ✅ Yes | ✅ Full | REST Concurrent GET/PUT | `write_themes` | None identified. |
| **Theme settings** (`theme_settings`) | Theme | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Templates & sections** (`templates`) | Theme | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Metafield definitions** (`metafields`) | Metafields | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Metaobjects** (`metaobjects`) | Metafields | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Discount codes & automatic** (`discounts`) | Commerce | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Shipping profiles & zones** (`shipping`) | Commerce | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Markets configuration** (`markets`) | Commerce | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Translations & locales** (`translations`) | Commerce | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Selling plans** (`selling_plans`) | Commerce | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Shop settings & brand** (`shop`) | Settings | ✅ Yes | ✅ Full | REST `paged` + REST PUT/POST | Varies by resource | None identified. |
| **Webhooks** (`webhooks`) | Settings | ❌ No | ❌ No | N/A | N/A | None identified. |
| **Payment providers (Shopify Payments, Stripe, PayPal)** (`payments`) | External | ❌ No | 🧑‍💻 Manual | N/A | N/A | None identified. |
| **Custom domains & DNS** (`domains`) | External | ❌ No | 🧑‍💻 Manual | N/A | N/A | None identified. |
| **Meta Pixel ownership** (`pixels`) | External | ❌ No | 🧑‍💻 Manual | N/A | N/A | None identified. |
| **Google Analytics / Merchant Center** (`google_analytics`) | External | ❌ No | 🧑‍💻 Manual | N/A | N/A | None identified. |
| **Email SPF / DKIM / DMARC** (`email_auth`) | External | ❌ No | 🧑‍💻 Manual | N/A | N/A | None identified. |
| **Third-party app subscriptions & data** (`third_party_apps`) | External | ❌ No | 🧑‍💻 Manual | N/A | N/A | App data is completely locked inside third-party servers. No Shopify API exists to extract this. |
| **Companies (B2B)** (`companies`) | Customers | ❌ No | ❌ No | N/A | N/A | ARCHITECTURAL LIMITATION: B2B features require Shopify Plus and some APIs are restricted. |
| **Price Lists** (`price_lists`) | Commerce | ❌ No | ❌ No | N/A | N/A | ARCHITECTURAL LIMITATION: Requires specific B2B API access. |
| **Scripts / Functions** (`scripts`) | Settings | ❌ No | ⛔ API Locked | N/A | N/A | SHOPIFY LIMITATION: Shopify Functions cannot be extracted in raw format via Admin API. |
| **App Configuration** (`app_config`) | External | ❌ No | ⛔ API Locked | N/A | N/A | SHOPIFY LIMITATION: Shopify architecture completely sandboxes app configurations. |


_Generated on 2026-07-21T07:29:56.530Z_
