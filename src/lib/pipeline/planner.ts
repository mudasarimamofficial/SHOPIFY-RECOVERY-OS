import { globalRegistry } from "./registry";
import type { ResourcePlugin } from "./registry";
import type { RecoveryManifest } from "./recovery-package";

export interface ExecutionStep {
  plugin: ResourcePlugin;
  estimatedCount: number;
  actionType: "create" | "update" | "skip" | "delete";
}

export class PlannerEngine {
  /**
   * Generates a deterministic DAG Execution Plan for restoring resources.
   * It analyzes the RecoveryManifest and evaluates cross-store implications.
   */
  generateRestorePlan(manifest: RecoveryManifest, targetDomain: string): ExecutionStep[] {
    const plugins = globalRegistry.getAll();
    const result: ExecutionStep[] = [];
    const visited = new Set<string>();
    const tempMark = new Set<string>();

    // Topological Sort
    const visit = (node: ResourcePlugin) => {
      if (tempMark.has(node.type)) throw new Error(`Circular dependency detected: ${node.type}`);
      if (!visited.has(node.type)) {
        tempMark.add(node.type);
        for (const dep of node.dependencies) {
          const depPlugin = plugins.find((p) => p.type === dep);
          if (depPlugin) visit(depPlugin);
        }
        tempMark.delete(node.type);
        visited.add(node.type);

        // Add to plan if it exists in the manifest
        const catalogItem = manifest.catalog.find((c) => c.type === node.type);
        if (catalogItem && catalogItem.count > 0) {
          result.push({
            plugin: node,
            estimatedCount: catalogItem.count,
            actionType: targetDomain === manifest.store_domain ? "update" : "create",
          });
        }
      }
    };

    for (const plugin of plugins) {
      if (!visited.has(plugin.type)) visit(plugin);
    }

    return result;
  }
}
