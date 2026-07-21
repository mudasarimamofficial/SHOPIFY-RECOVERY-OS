import { generateAndStoreReports } from "./sdk/migration/reports.server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export async function handleValidationApi(_request: Request) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase credentials in Production" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const fakeStoreDomain = "test-store-" + crypto.randomUUID().slice(0, 8) + ".myshopify.com";
    const backupId = "backup-" + crypto.randomUUID();

    const result = await generateAndStoreReports({
      backupId: backupId,
      restoreId: crypto.randomUUID(),
      storeA: fakeStoreDomain,
      storeB: fakeStoreDomain,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
