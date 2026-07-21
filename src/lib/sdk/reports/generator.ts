import { RESOURCE_CATALOG } from "../../resource-catalog";
import type { RecoveryWizardPlan } from "../recovery/intelligence";

export interface RecoveryReportContext {
  storeDomain: string;
  backupId: string;
  failedResources: Array<{ type: string; reason: string; items: string[] }>;
  manualResources: RecoveryWizardPlan[];
}

export function generateMerchantRecoveryBookMarkdown(ctx: RecoveryReportContext): string {
  const timestamp = new Date().toISOString();

  let markdown = `# Merchant Recovery Book\n\n`;
  markdown += `**Store:** ${ctx.storeDomain}\n`;
  markdown += `**Backup ID:** ${ctx.backupId}\n`;
  markdown += `**Generated At:** ${timestamp}\n\n`;

  markdown += `## Executive Summary\n`;
  markdown += `This document serves as your complete guide to rebuilding the parts of your Shopify store that could not be automatically restored due to platform limitations.\n\n`;

  if (ctx.failedResources.length > 0) {
    markdown += `## ⚠️ Shopify Limitation & Conflict Report\n`;
    markdown += `The following resources encountered unrecoverable conflicts or limitations:\n\n`;
    ctx.failedResources.forEach(failure => {
      markdown += `### ${failure.type}\n`;
      markdown += `- **Reason:** ${failure.reason}\n`;
      markdown += `- **Affected Items:** ${failure.items.length}\n`;
      markdown += "```text\n";
      failure.items.forEach(item => {
        markdown += `${item}\n`;
      });
      markdown += "```\n\n";
    });
  }

  markdown += `## 🛠️ Manual Recovery Guides\n\n`;
  if (ctx.manualResources.length === 0) {
    markdown += `*No manual recovery required! All configurations were restored automatically.*\n`;
  }

  ctx.manualResources.forEach(plan => {
    markdown += `### ${plan.resourceType.toUpperCase()}\n`;
    markdown += `- **Estimated Time:** ${plan.estimatedTimeMinutes} minutes\n`;
    markdown += `- **Difficulty:** ${plan.difficulty}\n\n`;
    
    markdown += `#### Step-by-Step Instructions\n`;
    plan.steps.forEach((step, idx) => {
      markdown += `${idx + 1}. **${step.title}**: ${step.instruction}\n`;
    });
    
    if (plan.extractedData) {
      markdown += `\n#### Extracted Configuration\n`;
      markdown += "```json\n";
      markdown += JSON.stringify(plan.extractedData, null, 2);
      markdown += "\n```\n";
    }
    markdown += `\n---\n\n`;
  });

  markdown += `## 📜 Recovery Certificate\n`;
  markdown += `This confirms the generation of the intelligent recovery sequence. All configurations not listed above were successfully recovered by Imam Recovery OS.\n`;

  return markdown;
}

export function triggerDownload(content: string, filename: string) {
  if (typeof window !== "undefined") {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
