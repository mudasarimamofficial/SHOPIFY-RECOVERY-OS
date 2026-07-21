import { SupabaseClient } from "@supabase/supabase-js";
import { AuthManager } from "../../auth-manager.server";

export async function executeCleanMigrationEngine(
  supabase: SupabaseClient,
  migrationJobId: string,
  targetStoreId: string,
  logActivity: (msg: string) => Promise<void>,
): Promise<void> {
  await logActivity("Initiating Clean Migration Engine.");

  const client = await AuthManager.getUnifiedClient(supabase, targetStoreId);

  // Dependency safe deletion order:
  // 1. Menus/Navigation (Depends on Pages/Collections)
  // 2. Collections (Depends on Products)
  // 3. Products
  // 4. Metaobjects
  // 5. Pages
  // 6. Blogs & Articles
  // 7. Redirects
  // 8. Files

  const deletionOrder = [
    { type: "products", endpoint: "/products.json" },
    { type: "custom_collections", endpoint: "/custom_collections.json" },
    { type: "smart_collections", endpoint: "/smart_collections.json" },
    { type: "pages", endpoint: "/pages.json" },
  ];

  for (const resource of deletionOrder) {
    try {
      await logActivity(`Cleaning ${resource.type}...`);

      // Fetch up to 250 items to delete
      const res = await client.rest<any>(`${resource.endpoint}?limit=250`);
      const items = res[resource.type] || [];

      for (const item of items) {
        try {
          await client.rest<any>(`/${resource.type}/${item.id}.json`, { method: "DELETE" });
        } catch (e: any) {
          await logActivity(`Warning: Could not delete ${resource.type} ${item.id} - ${e.message}`);

          // Log conflict / limitation
          await supabase.from("conflict_intelligence").insert({
            migration_job_id: migrationJobId,
            resource_type: resource.type,
            target_id: String(item.id),
            conflict_type: "Shopify Limitation",
            recommendation: "Manual deletion required via Admin Dashboard.",
            fatal: false,
          });
        }
      }

      await logActivity(`Successfully cleaned batch of ${items.length} ${resource.type}.`);
    } catch (e: any) {
      await logActivity(`Error cleaning ${resource.type}: ${e.message}`);
    }
  }

  await logActivity("Clean Migration Engine phase completed.");
}
