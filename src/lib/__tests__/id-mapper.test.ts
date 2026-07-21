import { describe, it, expect } from "vitest";
import { IdMapper } from "../pipeline/id-mapper";

describe("IdMapper", () => {
  it("should initialize with in-memory map fallback", async () => {
    const mockQueryBuilder: any = {
      eq: () => mockQueryBuilder,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
    };
    const mockAdmin: any = {
      from: () => ({
        select: () => mockQueryBuilder,
      }),
    };

    const mapper = new IdMapper(mockAdmin, "job-123", "user-456");
    expect(mapper).toBeDefined();
    const result = await mapper.get("gid://shopify/Product/111", "Product");
    expect(result).toBeNull();
  });
});
