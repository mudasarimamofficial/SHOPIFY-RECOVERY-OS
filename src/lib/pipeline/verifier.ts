import type { ApiAdapter } from "./registry";
import { globalEventBus } from "./event-bus";

export interface VerificationReport {
  resourceType: string;
  expectedCount: number;
  actualCount: number;
  missingGids: string[];
  status: "success" | "failed" | "partial";
}

export class VerificationEngine {
  /**
   * Cross-references the expected count from the Manifest with the actual target store API.
   */
  async verifyCounts(client: ApiAdapter, catalog: { type: string; count: number }[]): Promise<VerificationReport[]> {
    const reports: VerificationReport[] = [];
    
    for (const item of catalog) {
      if (item.count === 0) continue;
      
      try {
        // Query target store for current count. 
        // Note: In real life, some endpoints don't have a strict `count.json` or it's inaccurate. 
        // We'd rely on GraphQL connection totals where available.
        const res = await client.graphql<{ [key: string]: { count: number } }>(`
          query {
            ${item.type.replace('_bulk', '')} {
              count
            }
          }
        `);
        
        const actualCount = Object.values(res || {})[0]?.count || 0;
        
        const status = actualCount >= item.count ? "success" : (actualCount === 0 ? "failed" : "partial");
        
        reports.push({
          resourceType: item.type,
          expectedCount: item.count,
          actualCount,
          missingGids: [],
          status
        });
        
        if (status !== "success") {
          await globalEventBus.emit("VerificationFailed", {
            jobId: "system", storeDomain: "target", timestamp: new Date().toISOString(),
            meta: { resource: item.type, expected: item.count, actual: actualCount }
          });
        }
      } catch (err: any) {
        reports.push({
          resourceType: item.type,
          expectedCount: item.count,
          actualCount: 0,
          missingGids: [],
          status: "failed"
        });
      }
    }
    
    return reports;
  }
}
