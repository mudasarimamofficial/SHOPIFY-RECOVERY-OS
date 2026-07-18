import type { ShopifySDK } from "../sdk/shopify/client";

export type ApiAdapter = ShopifySDK;

export interface ResourceDelta {
  action: "create" | "update" | "delete" | "skip";
  resourceType: string;
  payload: any;
  reason?: string;
}

export interface ResourcePlugin {
  type: string;
  dependencies: string[]; // e.g. ["locations", "files"]

  scan(client: ApiAdapter): Promise<{ count: number }>;
  export(client: ApiAdapter, writer: any): Promise<void>;
  diff(sourceResource: any, targetResource: any): ResourceDelta;
  restore(client: ApiAdapter, delta: ResourceDelta, mapper: any): Promise<string>;
  verify(client: ApiAdapter, resourceId: string): Promise<boolean>;
  rollback(client: ApiAdapter, resourceId: string): Promise<void>;
}

export class ResourceRegistry {
  private plugins: Map<string, ResourcePlugin> = new Map();

  constructor() {
    this.autoDiscoverPlugins();
  }

  private autoDiscoverPlugins() {
    // Vite specific auto-discovery for all plugin modules
    const modules = import.meta.glob("./plugins/*.ts", { eager: true }) as Record<string, any>;

    for (const path in modules) {
      const module = modules[path];
      // Find the exported class that implements ResourcePlugin
      for (const key in module) {
        if (
          typeof module[key] === "function" &&
          module[key].prototype &&
          "type" in module[key].prototype
        ) {
          try {
            const pluginInstance = new module[key]() as ResourcePlugin;
            if (pluginInstance.type && typeof pluginInstance.scan === "function") {
              this.register(pluginInstance);
            }
          } catch (e) {
            console.error(`Failed to instantiate plugin from ${path}`, e);
          }
        }
      }
    }
  }

  register(plugin: ResourcePlugin) {
    this.plugins.set(plugin.type, plugin);
  }

  get(type: string): ResourcePlugin {
    const plugin = this.plugins.get(type);
    if (!plugin) throw new Error(`Plugin not found for resource type: ${type}`);
    return plugin;
  }

  getAll(): ResourcePlugin[] {
    return Array.from(this.plugins.values());
  }

  // Implements Topological Sort to generate deterministic execution order based on dependencies
  getExecutionPlan(): ResourcePlugin[] {
    const plugins = this.getAll();
    const result: ResourcePlugin[] = [];
    const visited = new Set<string>();
    const tempMark = new Set<string>();

    const visit = (node: ResourcePlugin) => {
      if (tempMark.has(node.type)) throw new Error(`Circular dependency detected: ${node.type}`);
      if (!visited.has(node.type)) {
        tempMark.add(node.type);
        for (const dep of node.dependencies) {
          const depPlugin = this.plugins.get(dep);
          if (depPlugin) visit(depPlugin);
        }
        tempMark.delete(node.type);
        visited.add(node.type);
        result.push(node);
      }
    };

    for (const plugin of plugins) {
      if (!visited.has(plugin.type)) visit(plugin);
    }

    return result;
  }
}

export const globalRegistry = new ResourceRegistry();
