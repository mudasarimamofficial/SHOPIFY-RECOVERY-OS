import { createClient } from "@supabase/supabase-js";
import { encryptToken } from "./src/lib/shopify.server";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

async function test() {
  console.log("=== BACKUP PIPELINE & DB TEST ===");
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Insert fake user
  console.log("Inserting fake user...");
  const { data: user, error: userErr } = await supabase.auth.admin.createUser({
    email: "test_pipeline@example.com",
    password: "test_password123",
    email_confirm: true
  });
  
  const userId = user?.user?.id;

  if (userErr && userErr.status !== 422) {
    console.error("User err:", userErr);
  }
  
  // Try to find the user if it already existed
  const actualUserId = userId || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === "test_pipeline@example.com")?.id;

  if (!actualUserId) throw new Error("Could not get a test user ID");

  // 2. Insert fake store
  const fakeEncryptedToken = encryptToken("shpua_test123");

  console.log("Upserting fake store...");
  const { data: store, error: storeErr } = await supabase.from("stores").upsert({
    user_id: actualUserId,
    shop_domain: "test-pipeline-store.myshopify.com",
    access_token_ciphertext: fakeEncryptedToken,
    is_active: true
  }).select().single();

  if (storeErr || !store) {
    console.error("Store Err:", storeErr);
    process.exit(1);
  }

  // 3. Trigger backup creation
  console.log("Creating backup record...");
  const { data: backup, error: backupErr } = await supabase.from("backups").insert({
    store_id: store.id,
    status: "pending",
    type: "manual"
  }).select().single();

  if (backupErr || !backup) {
    console.error("Backup Err:", backupErr);
    process.exit(1);
  }

  // 4. Try running the pipeline step with this store
  // It should fail with Shopify API unauthorized
  console.log("Importing backup logic...");
  const { stepBackup } = await import("./src/lib/backup.server.ts");
  
  console.log("Stepping backup...");
  try {
    const result = await stepBackup(supabase, store, backup.id);
    console.log("Result:", result);
    if (result.status === "failed") {
      console.log("Pipeline correctly reported failure due to invalid token.");
      console.log("STATUS: PASS");
    } else {
      console.log("Pipeline did not fail as expected.");
      console.log("STATUS: FAIL");
    }
  } catch (e: any) {
    console.log("Pipeline threw error gracefully:");
    console.log(e.message);
    if (e.message.includes("401") || e.message.includes("unauthorized") || e.message.includes("fetch")) {
      console.log("STATUS: PASS");
    } else {
      console.log("STATUS: FAIL");
    }
  }
}

test().catch(console.error);
