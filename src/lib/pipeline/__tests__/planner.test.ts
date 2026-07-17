import { describe, it, expect } from "vitest";
import { PlannerEngine } from "../planner";
import { globalRegistry } from "../registry";
import { ProductPlugin } from "../plugins/products";
import { CollectionPlugin } from "../plugins/collections";

describe("PlannerEngine", () => {
  it("generates a dependency-sorted execution plan", () => {
    // Register plugins
    globalRegistry.register(new ProductPlugin());
    globalRegistry.register(new CollectionPlugin());

    // In our setup: Collection depends on Product (and files)

    const planner = new PlannerEngine();
    const manifest: any = {
      store_domain: "source.myshopify.com",
      catalog: [
        { type: "collections", count: 10 },
        { type: "products", count: 50 },
      ],
    };

    const plan = planner.generateRestorePlan(manifest, "target.myshopify.com");

    // Both are in the manifest, but Product MUST come before Collection
    // Note: 'files' and 'locations' are not in the registry during this test, so it skips them.
    const productIdx = plan.findIndex((p) => p.plugin.type === "products");
    const collectionIdx = plan.findIndex((p) => p.plugin.type === "collections");

    expect(productIdx).toBeGreaterThan(-1);
    expect(collectionIdx).toBeGreaterThan(-1);
    expect(productIdx).toBeLessThan(collectionIdx);
  });
});
