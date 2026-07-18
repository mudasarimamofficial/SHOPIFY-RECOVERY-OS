import { globalRegistry } from "./registry";
import { ShopifySDK } from "../sdk/shopify/client";
import { RecoveryPackage } from "./recovery-package";
import { globalEventBus } from "./event-bus";
import { GIDMapper } from "./mapper";
import type { SupabaseClient } from "@supabase/supabase-js";

export class RestorePipeline {
  private mapper = new GIDMapper();

  constructor(
    private admin: SupabaseClient,
    private jobId: string,
    private backupId: string, // Source package ID
    private domain: string, // Target domain
    private token: string,
    private apiVersion: string,
  ) {}

  async execute() {
    const adapter = new ShopifySDK({
      domain: this.domain,
      token: this.token,
      apiVersion: this.apiVersion,
    });
    const pkg = new RecoveryPackage(this.admin, this.backupId);

    await globalEventBus.emit("PipelineStarted", {
      jobId: this.jobId,
      storeDomain: this.domain,
      timestamp: new Date().toISOString(),
      meta: { type: "restore" },
    });

    // 1. Validator Stage
    const isValid = await pkg.validate();
    if (!isValid) {
      await globalEventBus.emit("Error", {
        jobId: this.jobId,
        storeDomain: this.domain,
        timestamp: new Date().toISOString(),
        meta: { error: "Package integrity validation failed." },
      });
      throw new Error("Corrupt recovery package.");
    }

    const manifest = await pkg.readManifest();

    // 2. Planner & DAG Stage
    const plugins = globalRegistry.getExecutionPlan();

    for (const plugin of plugins) {
      try {
        const inCatalog = manifest.catalog.find((c) => c.type === plugin.type);
        if (!inCatalog || inCatalog.count === 0) continue;

        // Exporter Stage: Retrieve data from archive
        const rawData = await pkg.readResource(plugin.type);

        // For a production JSONL stream, we parse safely
        const lines = rawData.split("\n").filter((l) => l.trim().length > 0);

        for (const line of lines) {
          const sourceResource = JSON.parse(line);

          // 3. Differ Stage: Fetch the target resource to compare
          let targetResource = null;
          if (sourceResource.handle) {
            // Check if resource already exists via standard handle lookup (common for Shopify)
            const getQuery = `
              query {
                ${plugin.type}(first: 1, query: "handle:'${sourceResource.handle}'") {
                  edges { node { id updatedAt } }
                }
              }
            `;
            try {
              const res = await adapter.graphql<any>(getQuery);
              const nodes = res?.[plugin.type]?.edges || [];
              if (nodes.length > 0) targetResource = nodes[0].node;
            } catch (e) {
              // Target fetch failed, assume missing
            }
          }

          const delta = plugin.diff(sourceResource, targetResource);

          if (delta.action === "skip") {
            // Even if skipped, we map the ID if it exists
            if (targetResource?.id && sourceResource.id) {
              this.mapper.setMapping(sourceResource.id, targetResource.id);
            }
            continue;
          }

          // 4. Executor & Mapper Stage
          const newGid = await plugin.restore(adapter, delta, this.mapper);

          if (newGid && sourceResource.id) {
            this.mapper.setMapping(sourceResource.id, newGid);
          }

          // 5. Verifier Stage
          const verified = await plugin.verify(adapter, newGid);
          if (!verified) {
            await globalEventBus.emit("VerificationFailed", {
              jobId: this.jobId,
              storeDomain: this.domain,
              timestamp: new Date().toISOString(),
              meta: { resource: plugin.type, gid: newGid },
            });
            // Queue for Repair Pipeline in production
            console.warn(`Repair required for ${plugin.type} ${newGid}`);
          }
        }

        await globalEventBus.emit("ResourceRestored", {
          jobId: this.jobId,
          storeDomain: this.domain,
          timestamp: new Date().toISOString(),
          meta: { resource: plugin.type },
        });
      } catch (err: any) {
        await globalEventBus.emit("Error", {
          jobId: this.jobId,
          storeDomain: this.domain,
          timestamp: new Date().toISOString(),
          meta: { resource: plugin.type, error: err.message },
        });
        throw err;
      }
    }

    await globalEventBus.emit("PipelineCompleted", {
      jobId: this.jobId,
      storeDomain: this.domain,
      timestamp: new Date().toISOString(),
      meta: { status: "success" },
    });
  }
}
