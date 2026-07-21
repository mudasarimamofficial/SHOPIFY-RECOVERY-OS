import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "fs";

config({ path: ".env.production" });
config({ path: ".env" });
config({ path: ".env.local" });

const supabaseUrl = "https://xjbvzqflmkiaehpkcofx.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqYnZ6cWZsbWtpYWVocGtjb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNzY4MDQsImV4cCI6MjA5OTg1MjgwNH0.L_BAtTH4k63F85QG7i1Zjb3nqCsCErTHCHKk98WHnQc";

async function main() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const backupId = "f2186cce-2722-4bb0-a742-432f99b18518";

  const { data: backup, error } = await adminClient
    .from("backups")
    .select("package_data, store_id")
    .eq("id", backupId)
    .single();

  if (error || !backup) throw new Error("Backup not found");

  const { data: store } = await adminClient
    .from("stores")
    .select("shop_domain")
    .eq("id", backup.store_id)
    .single();

  const manifest = {
    format: "recovery/2",
    generated_at: new Date().toISOString(),
    api_version: "2024-01", // fallback
    store: { domain: store?.shop_domain || "unknown" },
    catalog: [],
    checksums: (backup.package_data as any)?.checksums || {},
  };

  const { error: updateErr } = await adminClient
    .from("backups")
    .update({ manifest })
    .eq("id", backupId);

  if (updateErr) {
    console.error("Failed to update", updateErr);
  } else {
    console.log("Manifest patched!");
  }
}

main().catch(console.error);
