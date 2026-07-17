import type { RecoveryManifest } from "./recovery-package";
import { globalEventBus } from "./event-bus";

export interface RiskReport {
  score: number; // 0 to 100, 100 being highest risk
  warnings: string[];
  recommendations: string[];
}

export class AiIntelligenceEngine {
  /**
   * Analyzes the RecoveryManifest post-backup and uses AI heuristics to determine
   * if the store is fundamentally recoverable or if critical data is missing.
   *
   * In a real deployment, this would ping OpenAI or an internal LLM model with the manifest summary.
   */
  async analyzeRisk(manifest: RecoveryManifest, apiScopes: string[]): Promise<RiskReport> {
    const report: RiskReport = {
      score: 0,
      warnings: [],
      recommendations: [],
    };

    // 1. Scope Analysis Heuristics
    if (!apiScopes.includes("read_orders")) {
      report.score += 30;
      report.warnings.push("Orders are not being backed up (missing read_orders scope).");
      report.recommendations.push("Request 'read_orders' scope from the Shopify merchant.");
    }

    // 2. Catalog Imbalance Heuristics
    const productsItem = manifest.catalog.find((c) => c.type === "products");
    const variantsItem = manifest.catalog.find((c) => c.type === "variants");
    const collectionsItem = manifest.catalog.find((c) => c.type === "collections");

    if (productsItem && productsItem.count > 0) {
      if (!variantsItem || variantsItem.count === 0) {
        report.score += 50;
        report.warnings.push(
          "Products were backed up, but 0 variants were found. This usually indicates an API pagination failure.",
        );
      }
      if (!collectionsItem || collectionsItem.count === 0) {
        report.score += 10;
        report.warnings.push("Store has products but 0 collections. Ensure this is intentional.");
      }
    }

    // Fire event for UI to display
    await globalEventBus.emit("PipelineCompleted", {
      jobId: "ai-analysis",
      storeDomain: manifest.store_domain,
      timestamp: new Date().toISOString(),
      meta: { type: "risk_report", report },
    });

    return report;
  }
}
