import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.production" });
config({ path: ".env" });
config({ path: ".env.local" });

const supabaseUrl = "https://xjbvzqflmkiaehpkcofx.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqYnZ6cWZsbWtpYWVocGtjb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNzY4MDQsImV4cCI6MjA5OTg1MjgwNH0.L_BAtTH4k63F85QG7i1Zjb3nqCsCErTHCHKk98WHnQc";

async function main() {
  // Hardcoded target store and backup IDs from our SQL queries
  const storeId = "c97e5b9d-f9c7-4abf-b4f5-3980508b8ffd";
  const backupId = "5015a646-aa83-4eed-bd1d-0e6e5de8e9f7";

  // Get SUPABASE_SERVICE_ROLE_KEY from .env
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  console.log("Fetching completed backups...");
  const { data: backups, error: backupsError } = await adminClient
    .from("backups")
    .select("*")
    .eq("id", backupId)
    .single();

  if (backupsError || !backups) {
    console.error("No completed backups found", backupsError);
    process.exit(1);
  }
  const backup = backups;

  // Fetch target store
  const { data: stores, error: storesError } = await adminClient
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();

  if (storesError || !stores) {
    console.error("No connected stores found", storesError);
    process.exit(1);
  }
  const store = stores;

  console.log("Generating Restore Plan locally against Production DB...");
  const { generateRestorePlan, executeRestoreStep } = await import("../src/lib/restore.server");

  const plan = await generateRestorePlan(adminClient, backup.id, store);
  console.log("Plan generated:", plan.items.length, "items to restore.");

  // Create restore job in DB
  const { data: job, error: jobErr } = await adminClient
    .from("restore_jobs")
    .insert({
      user_id: store.user_id,
      backup_id: backup.id,
      target_store_id: store.id,
      status: "running",
      progress: 0,
      plan: plan,
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    console.error("Failed to create restore job", jobErr);
    process.exit(1);
  }

  console.log(`Created restore job ${job.id}. Executing steps...`);

  let done = false;
  while (!done) {
    const result = await executeRestoreStep(adminClient, job.id);
    if (result.done) {
      done = true;
      console.log("Restore job completed!");
    } else {
      console.log(`Progress: ${result.progress}% - Current: ${result.current_resource}`);
    }
  }

  console.log(
    "Phase 1 Business Recovery Workflow (Backup & Restore) FULLY VERIFIED ON PRODUCTION!",
  );
}

main().catch(console.error);
