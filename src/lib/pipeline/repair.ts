import type { ApiAdapter, ResourcePlugin } from "./registry";
import { globalRegistry } from "./registry";
import type { VerificationReport } from "./verifier";
import { enqueueJob } from "../queue.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export class RepairEngine {
  /**
   * Analyzes VerificationReports and enqueues automated repair jobs for failed resources.
   */
  async scheduleRepairs(admin: SupabaseClient, reports: VerificationReport[], backupId: string, targetDomain: string) {
    for (const report of reports) {
      if (report.status === "success") continue;
      
      const plugin = globalRegistry.get(report.resourceType);
      
      // Enqueue a highly targeted Repair Job for this specific resource
      // The QueueWorker will pick this up and attempt to rebuild just the missing entities
      await enqueueJob(admin, "repair_resource", {
        backupId,
        targetDomain,
        resourceType: report.resourceType,
        expectedCount: report.expectedCount,
        actualCount: report.actualCount,
        missingGids: report.missingGids
      }, {
        queueName: "repair",
        priority: 100 // High priority
      });
    }
  }
}
