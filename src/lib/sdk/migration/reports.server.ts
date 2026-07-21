import { createClient } from "@supabase/supabase-js";
import { classifyShopifyError } from "./executor";
// Removed import

export interface ReportGenerationPayload {
  backupId: string;
  restoreId: string;
  storeA: string;
  storeB: string;
  compareResults?: any[];
  restoreResults?: any;
  telemetry?: any;
  conflicts?: any[];
}

export async function generateAndStoreReports(payload: ReportGenerationPayload) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const timestamp = new Date().toISOString();

  // 1. Merchant Recovery Book (Markdown)
  const recoveryBook = generateRecoveryBook(payload);

  // 2. Conflict Report
  const conflictReport = generateConflictReport(payload.conflicts || []);

  // 3. Deep Compare Report
  const compareReport = generateCompareReport(payload.compareResults || []);

  const reports = [
    { type: "Merchant Recovery Book", format: "md", content: recoveryBook },
    { type: "Conflict Report", format: "json", content: conflictReport },
    { type: "Deep Compare Report", format: "json", content: compareReport },
  ];

  for (const report of reports) {
    await supabase.from("reports").insert({
      backup_id: payload.backupId,
      restore_id: payload.restoreId,
      store_a: payload.storeA,
      store_b: payload.storeB,
      type: report.type,
      format: report.format,
      content: report.content,
      created_at: timestamp,
    });
  }

  // Telemetry persistence
  if (payload.telemetry) {
    await supabase.from("telemetry").insert({
      job_id: payload.restoreId,
      type: "RESTORE",
      duration_ms: payload.telemetry.duration,
      cpu_usage: payload.telemetry.cpu,
      peak_heap_mb: payload.telemetry.peakHeap,
      total_resources: payload.telemetry.totalResources,
      api_cost: payload.telemetry.apiCost,
      created_at: timestamp,
    });
  }

  return reports;
}

function generateRecoveryBook(payload: ReportGenerationPayload) {
  let md = `# Merchant Recovery Book\n\n`;
  md += `**Store A (Source):** ${payload.storeA}\n`;
  md += `**Store B (Destination):** ${payload.storeB}\n`;
  md += `**Timestamp:** ${new Date().toISOString()}\n\n`;

  md += `## Restore Statistics\n`;
  if (payload.restoreResults) {
    md += `- Total Resources Processed: ${payload.restoreResults.totalItems || 0}\n`;
    md += `- Successful Restores: ${payload.restoreResults.successCount || 0}\n`;
    md += `- Failures / Conflicts: ${payload.restoreResults.failureCount || 0}\n\n`;
  }

  md += `## Manual Migration Book\n`;
  md += `Due to Shopify API limitations, the following resources require manual configuration:\n\n`;

  // Generic list for now
  const manuals = [
    "Payment Providers",
    "Markets",
    "Domains",
    "Shipping",
    "Taxes",
    "Checkout Branding",
  ];
  for (const m of manuals) {
    md += `### ${m}\n- Status: Manual reconnect required.\n- Recommendation: Refer to the Recovery Wizard UI for step-by-step intelligence.\n\n`;
  }

  return md;
}

function generateConflictReport(conflicts: any[]) {
  return JSON.stringify(conflicts, null, 2);
}

function generateCompareReport(results: any[]) {
  return JSON.stringify(results, null, 2);
}
