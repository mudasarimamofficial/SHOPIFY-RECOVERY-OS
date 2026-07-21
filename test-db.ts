import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });

async function queryDb() {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Query stores
  console.log("\n=== STORES ===");
  const { data: stores } = await supabase.from("stores").select("id, shop_domain, name, status");
  console.log(stores);

  // Query backups
  console.log("\n=== RECENT BACKUPS ===");
  const { data: backups } = await supabase
    .from("backups")
    .select("id, label, status, progress, current_stage, errors_count, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log(backups);

  // Query restore jobs
  console.log("\n=== RECENT RESTORE JOBS ===");
  const { data: restoreJobs } = await supabase
    .from("restore_jobs")
    .select("id, backup_id, target_store_id, status, progress, report, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (restoreJobs) {
    for (const job of restoreJobs) {
      console.log(`Job ID: ${job.id}`);
      console.log(
        `Status: ${job.status}, Progress: ${job.progress}%, Created At: ${job.created_at}`,
      );
      console.log("Report payload:", JSON.stringify(job.report, null, 2));
      console.log("-----------------------------------------");
    }
  }

  // Query activity logs
  console.log("\n=== RECENT ACTIVITY LOG ===");
  const { data: activity } = await supabase
    .from("activity_log")
    .select("id, kind, title, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log(activity);
}

queryDb().catch(console.error);
