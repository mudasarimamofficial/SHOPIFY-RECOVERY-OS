import { globalRegistry } from "./registry";
import { ShopifyAdapter } from "./api-adapter";
import { RecoveryPackage } from "./recovery-package";
import { globalEventBus } from "./event-bus";
import type { SupabaseClient } from "@supabase/supabase-js";

export class BackupPipeline {
  constructor(
    private admin: SupabaseClient,
    private jobId: string,
    private domain: string,
    private token: string,
    private apiVersion: string
  ) {}

  async execute() {
    const adapter = new ShopifyAdapter({ domain: this.domain, token: this.token, apiVersion: this.apiVersion });
    const pkg = new RecoveryPackage(this.admin, this.jobId);
    
    await globalEventBus.emit("PipelineStarted", { jobId: this.jobId, storeDomain: this.domain, timestamp: new Date().toISOString(), meta: { type: "backup" } });
    
    await pkg.initialize(this.domain);
    
    // The DAG/Planner step
    const plugins = globalRegistry.getExecutionPlan();
    
    for (const plugin of plugins) {
      try {
        // 1. Scanner Stage
        const { count } = await plugin.scan(adapter);
        await globalEventBus.emit("ResourceScanned", { jobId: this.jobId, storeDomain: this.domain, timestamp: new Date().toISOString(), meta: { resource: plugin.type, count } });
        
        if (count === 0) continue;
        
        // 2. Exporter & Archiver Stage (handled by the plugin streaming into RecoveryPackage)
        await plugin.export(adapter, pkg);
        
        await globalEventBus.emit("ResourceExported", { jobId: this.jobId, storeDomain: this.domain, timestamp: new Date().toISOString(), meta: { resource: plugin.type } });
      } catch (err: any) {
        await globalEventBus.emit("Error", { jobId: this.jobId, storeDomain: this.domain, timestamp: new Date().toISOString(), meta: { resource: plugin.type, error: err.message } });
        throw err; // Depending on policy, we might continue and mark package as partial
      }
    }
    
    await globalEventBus.emit("PipelineCompleted", { jobId: this.jobId, storeDomain: this.domain, timestamp: new Date().toISOString(), meta: { status: "success" } });
  }
}
