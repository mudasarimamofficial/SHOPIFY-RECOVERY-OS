import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });

async function test() {
  console.log("=== SUPABASE SUBSYSTEM TEST ===");
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.from("stores").select("id").limit(1);
  if (error) {
    console.error("STATUS: FAIL");
    console.error(error);
    process.exit(1);
  }

  console.log("Database connection OK");
  console.log("Stores query result:", data);
  console.log("STATUS: PASS");
}

test().catch(console.error);
