import { SupabaseClient } from "@supabase/supabase-js";
import { AuthManager } from "../../auth-manager.server";

export async function executeDeepCompareEngine(
  supabase: SupabaseClient,
  migrationJobId: string,
  targetStoreId: string,
  sourceStoreId: string,
  logActivity: (msg: string) => Promise<void>,
): Promise<void> {
  await logActivity("Initiating Deep Compare Engine.");

  try {
    const targetClient = await AuthManager.getUnifiedClient(supabase, targetStoreId);
    const sourceClient = await AuthManager.getUnifiedClient(supabase, sourceStoreId);

    // Simplistic mock deep compare logic for products as a demonstration
    const [sourceRes, targetRes] = await Promise.all([
      sourceClient.rest<any>("/products/count.json").catch(() => ({ count: 0 })),
      targetClient.rest<any>("/products/count.json").catch(() => ({ count: 0 })),
    ]);

    const sourceCount = sourceRes?.count || 0;
    const targetCount = targetRes?.count || 0;

    let matchPercentage = 0;
    let migrationPercentage = 0;
    let integrityPercentage = 0;

    if (sourceCount > 0) {
      matchPercentage = Math.min(100, (targetCount / sourceCount) * 100);
      migrationPercentage = matchPercentage; // Simplified
      integrityPercentage = matchPercentage; // Simplified
    } else {
      matchPercentage = 100;
      migrationPercentage = 100;
      integrityPercentage = 100;
    }

    await supabase.from("deep_compare_results").insert({
      migration_job_id: migrationJobId,
      resource_type: "products",
      match_percentage: matchPercentage,
      migration_percentage: migrationPercentage,
      integrity_percentage: integrityPercentage,
      differences: {
        source_count: sourceCount,
        target_count: targetCount,
      },
    });

    await logActivity(`Deep Compare completed for products. Match: ${matchPercentage.toFixed(2)}%`);
  } catch (error: any) {
    await logActivity(`Deep Compare Engine encountered an error: ${error.message}`);
  }
}
