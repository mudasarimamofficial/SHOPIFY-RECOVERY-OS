import { SupabaseClient } from "@supabase/supabase-js";
import { AuthManager } from "../../auth-manager.server";

export interface PreparationReport {
  health_score: number;
  objects_detected: Record<string, number>;
  objects_to_delete: Record<string, number>;
  objects_to_merge: Record<string, number>;
  protected_objects: Record<string, number>;
  shopify_limitations: string[];
  estimated_duration_seconds: number;
  risk_score: number;
  warnings: string[];
  merchant_approval_summary: string;
}

export async function generateStorePreparationReport(
  supabase: SupabaseClient,
  migrationJobId: string,
  targetStoreId: string,
  mode: 'merge' | 'replace' | 'clean' | 'dry_run' | 'compare_only'
): Promise<PreparationReport> {
  const client = await AuthManager.getUnifiedClient(supabase, targetStoreId);

  // Default counts
  const objectsDetected: Record<string, number> = {
    products: 0,
    customers: 0,
    orders: 0,
    collections: 0,
    pages: 0,
    blogs: 0
  };

  try {
    const [
      prodRes,
      custRes,
      ordRes,
      smartRes,
      customRes,
      pageRes,
      blogRes
    ] = await Promise.all([
      client.rest<any>("/products/count.json").catch(() => ({ count: 0 })),
      client.rest<any>("/customers/count.json").catch(() => ({ count: 0 })),
      client.rest<any>("/orders/count.json?status=any").catch(() => ({ count: 0 })),
      client.rest<any>("/smart_collections/count.json").catch(() => ({ count: 0 })),
      client.rest<any>("/custom_collections/count.json").catch(() => ({ count: 0 })),
      client.rest<any>("/pages/count.json").catch(() => ({ count: 0 })),
      client.rest<any>("/blogs/count.json").catch(() => ({ count: 0 })),
    ]);

    objectsDetected.products = prodRes?.count || 0;
    objectsDetected.customers = custRes?.count || 0;
    objectsDetected.orders = ordRes?.count || 0;
    objectsDetected.collections = (smartRes?.count || 0) + (customRes?.count || 0);
    objectsDetected.pages = pageRes?.count || 0;
    objectsDetected.blogs = blogRes?.count || 0;
  } catch (error) {
    console.error("Preparation Engine: Failed to fetch some counts", error);
  }

  const totalObjects = Object.values(objectsDetected).reduce((sum, count) => sum + count, 0);

  let objectsToDelete = {};
  let objectsToMerge = {};
  
  if (mode === 'clean') {
    objectsToDelete = { ...objectsDetected };
  } else {
    objectsToMerge = { ...objectsDetected };
  }

  const riskScore = totalObjects > 10000 ? 80 : totalObjects > 1000 ? 50 : 10;
  const healthScore = 100 - (riskScore / 2);

  const report: PreparationReport = {
    health_score: healthScore,
    objects_detected: objectsDetected,
    objects_to_delete: objectsToDelete,
    objects_to_merge: objectsToMerge,
    protected_objects: {
      orders: objectsDetected.orders, // Orders are typically immutable or hard to safely delete
      customers: objectsDetected.customers
    },
    shopify_limitations: [
      "Orders cannot be deleted via standard REST without specific permissions.",
      "Gift cards can only be created via Plus API."
    ],
    estimated_duration_seconds: totalObjects * 0.5, // Rough estimate: 2 API calls per second
    risk_score: riskScore,
    warnings: mode === 'clean' ? ["Clean Migration will DESTROY existing Store B data!"] : [],
    merchant_approval_summary: `Migration Mode: ${mode.toUpperCase()}. ${totalObjects} existing resources detected.`
  };

  // Persist to DB
  await supabase.from("store_preparations").insert({
    migration_job_id: migrationJobId,
    target_store_id: targetStoreId,
    ...report
  });

  return report;
}
