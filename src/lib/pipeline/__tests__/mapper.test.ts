import { describe, it, expect, beforeEach } from "vitest";
import { GIDMapper } from "../mapper";

describe("GIDMapper", () => {
  let mapper: GIDMapper;

  beforeEach(() => {
    mapper = new GIDMapper();
  });

  it("translates simple string GIDs", () => {
    mapper.setMapping("gid://shopify/Product/123", "gid://shopify/Product/999");

    const result = mapper.translatePayload("gid://shopify/Product/123");
    expect(result).toBe("gid://shopify/Product/999");
  });

  it("translates deeply nested GIDs in objects and arrays", () => {
    mapper.setMapping("gid://shopify/Collection/1", "gid://shopify/Collection/2");
    mapper.setMapping("gid://shopify/Product/1", "gid://shopify/Product/2");

    const payload = {
      title: "Summer Sale",
      collection: "gid://shopify/Collection/1",
      products: [{ id: "gid://shopify/Product/1" }, "gid://shopify/Product/1"],
      meta: {
        related: "gid://shopify/Product/1",
      },
    };

    const translated = mapper.translatePayload(payload);

    expect(translated.collection).toBe("gid://shopify/Collection/2");
    expect(translated.products[0].id).toBe("gid://shopify/Product/2");
    expect(translated.products[1]).toBe("gid://shopify/Product/2");
    expect(translated.meta.related).toBe("gid://shopify/Product/2");
  });

  it("ignores GIDs without mapping", () => {
    const result = mapper.translatePayload("gid://shopify/Product/404");
    expect(result).toBe("gid://shopify/Product/404");
  });
});
