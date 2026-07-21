import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { generateAndStoreReports } from "../src/lib/sdk/migration/reports.server";
import crypto from "node:crypto";

async function main() {
  console.log("=== PHASE 1: Runtime Validation of Reports ===");

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials for runtime validation.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const mockBackupId = `test-backup-${crypto.randomUUID()}`;
  const mockRestoreId = `test-restore-${crypto.randomUUID()}`;
  const storeA = "store-a-runtime-test.myshopify.com";
  const storeB = "store-b-runtime-test.myshopify.com";

  console.log(`Simulating Restore Complete Hook for Job: ${mockRestoreId}`);

  // 1. Trigger generateAndStoreReports natively
  const reports = await generateAndStoreReports({
    backupId: mockBackupId,
    restoreId: mockRestoreId,
    storeA,
    storeB,
    restoreResults: {
      totalItems: 50,
      successCount: 45,
      failureCount: 5,
    },
    conflicts: [{ id: "gid://shopify/Product/123", error: "Permission Limitation" }],
    telemetry: {
      duration: 12500,
      cpu: 45.2,
      peakHeap: 120,
      totalResources: 50,
      apiCost: 450,
    },
  });

  if (!reports || reports.length === 0) {
    console.error("❌ Failed to generate reports in memory.");
    process.exit(1);
  }
  console.log(`✅ Generated ${reports.length} reports in memory.`);

  // 2. Verify persistence in Supabase
  console.log("Querying Supabase to verify persistence...");

  // Wait a moment for async insert (though it is awaited in the function)
  await new Promise((r) => setTimeout(r, 1000));

  const { data: storedReports, error } = await supabase
    .from("reports")
    .select("*")
    .eq("restore_id", mockRestoreId);

  if (error) {
    console.error("❌ Supabase query error:", error);
    process.exit(1);
  }

  if (!storedReports || storedReports.length === 0) {
    console.error("❌ Reports were NOT persisted to Supabase.");
    process.exit(1);
  }

  console.log(`✅ Found ${storedReports.length} reports persisted in Supabase.`);
  storedReports.forEach((r) => {
    console.log(`   - [${r.format.toUpperCase()}] ${r.type}`);
  });

  const { data: storedTelemetry, error: telError } = await supabase
    .from("telemetry")
    .select("*")
    .eq("job_id", mockRestoreId)
    .single();

  if (telError || !storedTelemetry) {
    console.error("❌ Telemetry was NOT persisted to Supabase.");
    process.exit(1);
  }

  console.log(
    `✅ Telemetry persisted successfully (Duration: ${storedTelemetry.duration_ms}ms, Peak Heap: ${storedTelemetry.peak_heap_mb}MB).`,
  );

  // Cleanup test data
  await supabase.from("reports").delete().eq("restore_id", mockRestoreId);
  await supabase.from("telemetry").delete().eq("job_id", mockRestoreId);

  console.log("=== PHASE 1 VALIDATION COMPLETE ===");
}

main().catch(console.error);
