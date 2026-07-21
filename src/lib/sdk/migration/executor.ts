import type { ShopifyClient } from "../../shopify.server";
import { IdMapper } from "../../pipeline/id-mapper";

export type ErrorClassification =
  | "Shopify Limitation"
  | "Permission Limitation"
  | "Rate Limit"
  | "Network Failure"
  | "API Change"
  | "Current Implementation Bug"
  | "Unsupported Endpoint"
  | "Data Corruption"
  | "Configuration Issue"
  | "Already Exists"
  | "Duplicate"
  | "Conflict"
  | "Skipped"
  | "Merged"
  | "Updated"
  | "No Change"
  | "User Decision Required"
  | "Unknown";

export function classifyShopifyError(e: any): ErrorClassification {
  const msg = (e.message || String(e)).toLowerCase();

  // Conflict Intelligence
  if (
    msg.includes("path has already been taken") ||
    msg.includes("already taken") ||
    msg.includes("has already been taken")
  ) {
    return "Already Exists";
  }
  if (msg.includes("must be unique") || msg.includes("already exists")) {
    return "Conflict";
  }

  // Core Failures
  if (msg.includes("shopify limitation")) return "Shopify Limitation";
  if (msg.includes("permission issue") || msg.includes("configuration issue"))
    return "Configuration Issue";
  if (msg.includes("current implementation bug")) return "Current Implementation Bug";

  if (msg.includes("unsupported endpoint") || msg.includes("404") || msg.includes("not found"))
    return "Unsupported Endpoint";
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("throttled"))
    return "Rate Limit";
  if (
    msg.includes("403") ||
    msg.includes("unauthorized") ||
    msg.includes("access denied") ||
    msg.includes("scope")
  )
    return "Permission Limitation";
  if (
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("timeout") ||
    msg.includes("fetch failed")
  )
    return "Network Failure";
  if (msg.includes("deprecated")) return "API Change";

  // Strict Corruption Detection
  if (msg.includes("invalid") || msg.includes("malformed") || msg.includes("json"))
    return "Data Corruption";
  if (msg.includes("cannot be blank") || msg.includes("is required")) return "Data Corruption";

  return "Unknown";
}

import { Readable } from "node:stream";
import readline from "node:readline";

async function parseChunkFromBlob(
  blob: Blob | ArrayBuffer,
  baseResource: string,
  resourceType: string,
  offset: number,
  limit: number,
) {
  let items: any[] = [];
  let totalItems = 0;

  let webBlob: Blob;
  if (blob instanceof ArrayBuffer) {
    webBlob = new Blob([blob]);
  } else {
    webBlob = blob;
  }

  if (baseResource !== "products" && !resourceType.endsWith("_bulk")) {
    const text = await webBlob.text();
    const parsed = JSON.parse(text);
    const all = Array.isArray(parsed) ? parsed : [parsed];
    totalItems = all.length;
    items = all.slice(offset, offset + limit);
    return { items, totalItems };
  }

  const stream = Readable.fromWeb(webBlob.stream() as any);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  if (baseResource === "products") {
    let currentProductGroup: any = null;
    for await (const line of rl) {
      if (!line.trim()) continue;
      const item = JSON.parse(line);

      if (item.id && item.id.includes("ProductVariant")) {
        if (currentProductGroup && currentProductGroup.product.id === item.__parentId) {
          currentProductGroup.variants.push(item);
        }
      } else if (item.id && item.id.includes("Product")) {
        if (currentProductGroup) {
          totalItems++;
          if (totalItems - 1 >= offset && items.length < limit) {
            items.push(currentProductGroup);
          }
        }
        currentProductGroup = { product: item, variants: [] };
      }
    }
    if (currentProductGroup) {
      totalItems++;
      if (totalItems - 1 >= offset && items.length < limit) {
        items.push(currentProductGroup);
      }
    }
  } else {
    for await (const line of rl) {
      if (!line.trim()) continue;
      totalItems++;
      if (totalItems - 1 >= offset && items.length < limit) {
        items.push(JSON.parse(line));
      }
    }
  }

  return { items, totalItems };
}

export async function executeResourceRestore(
  client: ShopifyClient,
  resourceType: string,
  action: "create" | "update" | "skip" | "conflict",
  fileData: Blob | ArrayBuffer,
  isSameStore: boolean,
  idMapper: IdMapper,
  offset = 0,
  limit = 150,
) {
  const baseResource = resourceType.replace("_bulk", "");
  const { items, totalItems } = await parseChunkFromBlob(
    fileData,
    baseResource,
    resourceType,
    offset,
    limit,
  );
  const chunk = items;

  let successCount = 0;
  let failureCount = 0;
  const successfulKeys: string[] = [];
  const failedKeys: {
    id: string;
    classification?: string;
    error: string;
    payload?: any;
    response?: any;
  }[] = [];

  for (const item of chunk) {
    const itemKey = item.id || item.node?.id || item.handle || "unknown";
    try {
      if (baseResource === "pages") {
        await restorePage(client, item, isSameStore);
      } else if (baseResource === "collections") {
        await restoreCollection(client, item, isSameStore, idMapper);
      } else if (baseResource === "products") {
        await restoreProduct(client, item, isSameStore, idMapper);
      } else if (baseResource === "customers") {
        await restoreCustomer(client, item, isSameStore, idMapper);
      } else if (baseResource === "locations") {
        await restoreLocation(client, item, idMapper);
      } else if (baseResource === "blogs") {
        await restoreBlog(client, item, isSameStore, idMapper);
      } else if (baseResource === "articles") {
        await restoreArticle(client, item, isSameStore, idMapper);
      } else if (baseResource === "redirects") {
        await restoreRedirect(client, item, isSameStore);
      } else if (baseResource === "metaobject_definitions") {
        await restoreMetaobjectDefinition(client, item);
      } else if (baseResource === "metaobjects") {
        await restoreMetaobject(client, item, idMapper);
      } else if (baseResource === "metafield_definitions") {
        await restoreMetafieldDefinition(client, item);
      } else {
        throw new Error(
          `Unsupported Endpoint: no verified restore handler exists for ${baseResource}`,
        );
      }
      successCount++;
      successfulKeys.push(itemKey);
    } catch (e: any) {
      const classification = classifyShopifyError(e);
      console.error(`[${classification}] Failed to restore ${baseResource}:`, e);
      failureCount++;
      failedKeys.push({
        id: itemKey,
        classification,
        error: e.message || String(e),
        payload: e.payload,
        response: e.response,
      });
    }
    // Simple rate limit delay
    await new Promise((r) => setTimeout(r, 50));
  }

  return {
    successCount,
    failureCount,
    successfulKeys,
    failedKeys,
    processedCount: chunk.length,
    totalItems,
  };
}

async function restorePage(client: ShopifyClient, item: any, isSameStore: boolean) {
  const payload = { page: { title: item.title, body_html: item.body_html, handle: item.handle } };
  if (isSameStore && item.id) {
    // Attempt update
    try {
      await client.rest(`/pages/${item.id}.json`, { method: "PUT", body: JSON.stringify(payload) });
      return;
    } catch {
      // Fallback to create on error
    }
  }
  // Fallback to create
  await client.rest(`/pages.json`, { method: "POST", body: JSON.stringify(payload) });
}

async function restoreCollection(
  client: ShopifyClient,
  item: any,
  isSameStore: boolean,
  idMapper: IdMapper,
) {
  const node = item.node || item;
  const isSmart = !!node.ruleSet;

  const input: any = {
    title: node.title,
    descriptionHtml: node.descriptionHtml,
    handle: node.handle,
    templateSuffix: node.templateSuffix,
  };

  if (isSmart) {
    input.ruleSet = node.ruleSet;
  } else if (node.products?.edges?.length > 0) {
    // Custom collection: we need to map product IDs to the new store
    const oldProductIds = node.products.edges.map((e: any) => e.node.id);
    const mappedIds = await Promise.all(
      oldProductIds.map((id: string) => idMapper.get(id, "Product")),
    );
    const newProductIds = mappedIds.filter(Boolean);
    if (newProductIds.length > 0) {
      input.products = newProductIds;
    }
  }

  // Determine if same store update is possible
  if (isSameStore && node.id) {
    input.id = node.id;
    try {
      const updateMutation = `
        mutation collectionUpdate($input: CollectionInput!) {
          collectionUpdate(input: $input) {
            collection { id }
            userErrors { field message }
          }
        }
      `;
      const res = await client.graphql<any>(updateMutation, { input });
      if (res.collectionUpdate?.userErrors?.length > 0) {
        const err: any = new Error(JSON.stringify(res.collectionUpdate.userErrors));
        err.payload = input;
        err.response = res;
        throw err;
      }
      return;
    } catch (err) {
      console.warn(`Same-store collection update failed, falling back to recreation`, err);
      delete input.id; // prepare for fallback create
    }
  }

  const createMutation = `
    mutation collectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection { id }
        userErrors { field message }
      }
    }
  `;
  const res = await client.graphql<any>(createMutation, { input });
  if (res.collectionCreate?.userErrors?.length > 0) {
    const err: any = new Error(JSON.stringify(res.collectionCreate.userErrors));
    err.payload = input;
    err.response = res;
    throw err;
  }

  if (res.collectionCreate?.collection?.id && node.id) {
    await idMapper.set(node.id, res.collectionCreate.collection.id, "Collection");
  }
}

async function restoreProduct(
  client: ShopifyClient,
  group: { product: any; variants: any[] },
  isSameStore: boolean,
  idMapper: IdMapper,
) {
  const node = group.product;
  const variants = group.variants;

  const productInput: any = {
    title: node.title,
    descriptionHtml: node.descriptionHtml,
    vendor: node.vendor,
    productType: node.productType,
    handle: node.handle,
    status: node.status || "ACTIVE",
    tags: node.tags,
  };

  if (node.options && Array.isArray(node.options)) {
    productInput.productOptions = node.options.map((opt: any) => ({
      name: opt.name,
      values: opt.values.map((v: any) => ({ name: typeof v === "string" ? v : v.name || v })),
    }));
  }

  if (node.media && node.media.edges) {
    productInput.files = node.media.edges
      .map((e: any) => {
        const m = e.node;
        const sourceUrl = m.image?.url || m.sources?.[0]?.url;
        if (!sourceUrl) return null;
        return {
          originalSource: sourceUrl,
          alt: m.alt || m.image?.altText || "",
          contentType: m.mediaContentType,
        };
      })
      .filter(Boolean);
  }

  productInput.variants = variants.map((v) => {
    const vInput: any = {
      price: v.price,
      sku: v.sku,
      inventoryPolicy: v.inventoryPolicy || "DENY",
      taxable: v.taxable ?? true,
      barcode: v.barcode,
      compareAtPrice: v.compareAtPrice,
      requiresShipping: v.inventoryItem?.requiresShipping ?? true,
      inventoryItem: {
        measurement: v.inventoryItem?.measurement || {
          weight: { value: v.weight, unit: v.weightUnit },
        },
      },
    };

    if (v.selectedOptions) {
      vInput.optionValues = v.selectedOptions.map((so: any) => ({
        optionName: so.name,
        name: so.value,
      }));
    } else if (v.title && v.title !== "Default Title") {
      // Fallback
      vInput.optionValues = v.title.split(" / ").map((val: string, idx: number) => ({
        optionName: `Option ${idx + 1}`,
        name: val,
      }));
    }

    if (v.inventoryItem?.inventoryLevels?.edges) {
      // Need to resolve locations asynchronously. Since we are inside map, we will use Promise.all below.
      // But wait, the map is synchronous. We must map synchronously first, then resolve locations, or use a for loop.
      vInput.tempInventoryLevels = v.inventoryItem.inventoryLevels.edges;
    }
    return vInput;
  });

  // Resolve locations asynchronously
  for (const vInput of productInput.variants) {
    if (vInput.tempInventoryLevels) {
      const qs: any[] = [];
      for (const edge of vInput.tempInventoryLevels) {
        const level = edge.node;
        const available = level.quantities?.find((q: any) => q.name === "available");
        const oldLocationId = level.location?.id;
        const newLocationId = oldLocationId ? await idMapper.get(oldLocationId, "Location") : null;
        if (!newLocationId) {
          throw new Error(
            `Configuration Issue: destination is missing a mapped location for ${oldLocationId ?? "an inventory level"}`,
          );
        }

        if (available) {
          qs.push({
            locationId: newLocationId,
            name: "available",
            quantity: available.quantity,
          });
        }
      }
      vInput.inventoryQuantities = qs;
      delete vInput.tempInventoryLevels;
    }
  }

  const mutation = `
    mutation productSet($identifier: ProductSetIdentifiers, $input: ProductSetInput!) {
      productSet(identifier: $identifier, input: $input) {
        product {
          id
          variants(first: 250) {
            edges {
              node {
                id
                title
                sku
              }
            }
            pageInfo { hasNextPage }
          }
        }
        userErrors { field message }
      }
    }
  `;

  // Apply rate limiting / retry internally in client if needed, or here.
  const existingProductId = await idMapper.get(node.id, "Product");
  const res = await client.graphql<any>(mutation, {
    identifier: existingProductId ? { id: existingProductId } : undefined,
    input: productInput,
  });

  if (res.productSet?.userErrors?.length > 0) {
    const err: any = new Error(JSON.stringify(res.productSet.userErrors));
    err.payload = productInput;
    err.response = res;
    throw err;
  }

  const newProduct = res.productSet?.product;
  if (!newProduct) {
    throw new Error("Failed to create product - empty response");
  }

  // Record mappings for product and variants
  await idMapper.set(node.id, newProduct.id, "Product");

  if (newProduct.variants.pageInfo?.hasNextPage) {
    throw new Error(
      "Current Implementation Bug: product variant mapping exceeds the supported response page size.",
    );
  }
  const newVariants = newProduct.variants.edges.map((e: any) => e.node);
  for (const originalVariant of variants) {
    const matchingNewVariant =
      newVariants.find(
        (nv: any) =>
          (originalVariant.sku && nv.sku === originalVariant.sku) ||
          nv.title === originalVariant.title,
      ) || newVariants[0];

    if (matchingNewVariant) {
      await idMapper.set(originalVariant.id, matchingNewVariant.id, "ProductVariant");
    }
  }
}

async function restoreCustomer(
  client: ShopifyClient,
  item: any,
  isSameStore: boolean,
  idMapper: IdMapper,
) {
  const node = item.node || item;

  const variables = {
    input: {
      firstName: node.firstName,
      lastName: node.lastName,
      email: node.email,
      phone: node.phone,
      note: node.note,
      tags: node.tags,
    },
  };

  const createMutation = `
    mutation customerCreate($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer { id }
        userErrors { field message }
      }
    }
  `;

  try {
    const res = await client.graphql<any>(createMutation, variables);
    if (res.customerCreate?.userErrors?.length > 0) {
      const isTaken = res.customerCreate.userErrors.some(
        (err: any) => err.message.includes("taken") || err.message.includes("already"),
      );
      if (isTaken && node.email) {
        // Customer already exists, search and find existing ID
        const searchRes = await client.graphql<any>(`
          query {
            customers(first: 1, query: "email:'${node.email}'") {
              edges {
                node {
                  id
                }
              }
            }
          }
        `);
        const existingId = searchRes?.customers?.edges?.[0]?.node?.id;
        if (existingId) {
          await idMapper.set(node.id, existingId, "Customer");
          console.log(`Mapped existing customer ${node.email} -> ${existingId}`);
          return;
        }
      }
      const err: any = new Error(JSON.stringify(res.customerCreate.userErrors));
      err.payload = variables;
      err.response = res;
      throw err;
    }
    if (res.customerCreate?.customer?.id) {
      await idMapper.set(node.id, res.customerCreate.customer.id, "Customer");
    }
  } catch (err) {
    if (isSameStore && node.id) {
      await idMapper.set(node.id, node.id, "Customer");
    } else {
      throw err;
    }
  }
}

async function restoreOrder(
  client: ShopifyClient,
  item: any,
  isSameStore: boolean,
  idMapper: IdMapper,
) {
  const node = item.node || item;

  let fStatus = node.displayFulfillmentStatus?.toLowerCase();
  if (fStatus === "partially_fulfilled") fStatus = "partial";
  if (fStatus === "unfulfilled") fStatus = null;

  const payload: any = {
    order: {
      name: node.name,
      email: node.email,
      phone: node.phone,
      created_at: node.createdAt,
      updated_at: node.updatedAt,
      financial_status: node.displayFinancialStatus?.toLowerCase(),
      fulfillment_status: fStatus,
      note: node.note,
      tags: node.tags?.join(", ") || "",
    },
  };

  // Clean up undefined fields
  Object.keys(payload.order).forEach((key) => {
    if (payload.order[key] === undefined) delete payload.order[key];
  });

  // Translate customer ID if present
  if (node.customer?.id) {
    const oldCustId = node.customer.id;
    const newCustId = await idMapper.get(oldCustId, "Customer");
    if (newCustId) {
      payload.order.customer = { id: parseInt(newCustId.split("/").pop()!) };
    }
  }

  // Translate line items
  if (node.lineItems?.edges) {
    payload.order.line_items = [];
    for (const edge of node.lineItems.edges) {
      const line = edge.node;
      const result: any = {
        title: line.title,
        quantity: line.quantity,
      };

      if (line.variant?.id) {
        const newVarId = await idMapper.get(line.variant.id, "ProductVariant");
        if (newVarId) result.variant_id = parseInt(newVarId.split("/").pop()!);
      }
      if (line.product?.id) {
        const newProdId = await idMapper.get(line.product.id, "Product");
        if (newProdId) result.product_id = parseInt(newProdId.split("/").pop()!);
      }

      payload.order.line_items.push(result);
    }
  }

  await client.rest(`/orders.json`, { method: "POST", body: JSON.stringify(payload) });
}

async function restoreLocation(client: ShopifyClient, item: any, idMapper: IdMapper) {
  if (!item.id || !item.name) {
    throw new Error("Data Corruption: location backup is missing its ID or name.");
  }
  const targetLocations = await client.paged<{ id: number; name: string }>(
    "/locations.json",
    "locations",
  );
  const target = targetLocations.find((location) => location.name === item.name);
  if (!target) {
    throw new Error(
      `Shopify Limitation: destination location '${item.name}' must be created and activated before inventory can be migrated.`,
    );
  }
  await idMapper.set(
    `gid://shopify/Location/${item.id}`,
    `gid://shopify/Location/${target.id}`,
    "Location",
  );
}

async function restoreBlog(
  client: ShopifyClient,
  item: any,
  isSameStore: boolean,
  idMapper: IdMapper,
) {
  const payload = {
    blog: { title: item.title, handle: item.handle, commentable: item.commentable },
  };
  if (isSameStore && item.id) {
    try {
      const res = await client.rest<any>(`/blogs/${item.id}.json`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (res?.blog?.id) {
        const oldGid = `gid://shopify/OnlineStoreBlog/${item.id}`;
        const newGid = `gid://shopify/OnlineStoreBlog/${res.blog.id}`;
        await idMapper.set(oldGid, newGid, "Blog");
      }
      return;
    } catch {
      // Fallback to create on error
    }
  }
  const res = await client.rest<any>(`/blogs.json`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res?.blog?.id && item.id) {
    const oldGid = `gid://shopify/OnlineStoreBlog/${item.id}`;
    const newGid = `gid://shopify/OnlineStoreBlog/${res.blog.id}`;
    await idMapper.set(oldGid, newGid, "Blog");
  }
}

async function restoreArticle(
  client: ShopifyClient,
  item: any,
  isSameStore: boolean,
  idMapper: IdMapper,
) {
  const payload = {
    article: { title: item.title, author: item.author, body_html: item.body_html },
  };

  let targetBlogId = item.blog_id;
  if (!isSameStore && item.blog_id) {
    const oldBlogGid = `gid://shopify/OnlineStoreBlog/${item.blog_id}`;
    const newBlogGid = await idMapper.get(oldBlogGid, "Blog");
    if (newBlogGid) {
      targetBlogId = parseInt(newBlogGid.split("/").pop()!);
    }
  }

  if (isSameStore && item.id && targetBlogId) {
    try {
      await client.rest(`/blogs/${targetBlogId}/articles/${item.id}.json`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return;
    } catch {
      // Fallback to create on error
    }
  }
  if (targetBlogId) {
    await client.rest(`/blogs/${targetBlogId}/articles.json`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

async function restoreRedirect(client: ShopifyClient, item: any, isSameStore: boolean) {
  const payload = { redirect: { path: item.path, target: item.target } };
  if (isSameStore && item.id) {
    try {
      await client.rest(`/redirects/${item.id}.json`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return;
    } catch {
      // Fallback to create on error
    }
  }
  await client.rest(`/redirects.json`, { method: "POST", body: JSON.stringify(payload) });
}

async function restoreTheme(client: ShopifyClient, item: any, isSameStore: boolean) {
  const { runWithConcurrency } = await import("../../shopify.server");

  // item might be the root object { theme, assets } or just the theme
  const themeObj = item.theme || item;
  const payload = { theme: { name: themeObj.name, role: themeObj.role } };

  let targetThemeId: number;
  if (isSameStore && themeObj.id) {
    try {
      const res = await client.rest<any>(`/themes/${themeObj.id}.json`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      targetThemeId = themeObj.id;
    } catch {
      const res = await client.rest<any>(`/themes.json`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      targetThemeId = res.theme?.id;
    }
  } else {
    const res = await client.rest<any>(`/themes.json`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    targetThemeId = res.theme?.id;
  }

  if (targetThemeId && item.assets && Array.isArray(item.assets) && item.assets.length > 0) {
    const uploadAsset = async (assetData: any) => {
      // Skip empty or missing assets
      if (!assetData || (!assetData.value && !assetData.attachment)) return;

      const assetPayload: any = { key: assetData.key };
      if (assetData.value) assetPayload.value = assetData.value;
      if (assetData.attachment) assetPayload.attachment = assetData.attachment;

      await client
        .rest(`/themes/${targetThemeId}/assets.json`, {
          method: "PUT",
          body: JSON.stringify({ asset: assetPayload }),
        })
        .catch((e) => {
          console.warn(`Failed to restore asset ${assetData.key}:`, e);
        });
    };

    // Use throttled concurrency to respect API limits
    await runWithConcurrency(item.assets, 5, uploadAsset);
  }
}

async function restoreMetaobjectDefinition(client: ShopifyClient, item: any) {
  const node = item.node || item;
  const input = {
    name: node.name,
    type: node.type,
    description: node.description,
    access: {
      admin: node.access?.admin || "MERCHANT_READ_WRITE",
      storefront: node.access?.storefront || "NONE",
    },
    fieldDefinitions: (node.fieldDefinitions || []).map((fd: any) => ({
      key: fd.key,
      name: fd.name,
      type: fd.type,
      required: fd.required,
      description: fd.description,
      validations: fd.validations || [],
    })),
  };

  const gql = `
    mutation metaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition { id }
        userErrors { field message }
      }
    }
  `;
  const res = await client.graphql<any>(gql, { definition: input });
  if (res.metaobjectDefinitionCreate?.userErrors?.length > 0) {
    const err = res.metaobjectDefinitionCreate.userErrors[0];
    if (err.message.includes("already taken")) return; // skip if exists
    throw new Error(err.message);
  }
}

async function restoreMetaobject(client: ShopifyClient, item: any, idMapper: IdMapper) {
  const node = item.node || item;
  const fields = node.fields || [];

  // Note: we would need to map GID references inside fields here using idMapper
  // but for now we simply pass the string values exactly as they are.
  const input = {
    type: node.type,
    handle: node.handle,
    fields: fields.map((f: any) => ({ key: f.key, value: String(f.value) })),
  };

  const gql = `
    mutation metaobjectCreate($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message }
      }
    }
  `;
  const res = await client.graphql<any>(gql, { metaobject: input });
  if (res.metaobjectCreate?.userErrors?.length > 0) {
    const err = res.metaobjectCreate.userErrors[0];
    if (err.message.includes("already taken")) return;
    throw new Error(err.message);
  }
}

async function restoreMetafieldDefinition(client: ShopifyClient, item: any) {
  const node = item.node || item;
  // Note: metafieldDefinitionCreate is highly restricted, we attempt basic fields
  const input = {
    name: node.name,
    namespace: node.namespace,
    key: node.key,
    description: node.description,
    type: node.type,
    ownerType: node.ownerType || "PRODUCT", // fallback
    validations: node.validations || [],
  };

  const gql = `
    mutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id }
        userErrors { field message }
      }
    }
  `;
  const res = await client.graphql<any>(gql, { definition: input });
  if (res.metafieldDefinitionCreate?.userErrors?.length > 0) {
    const err = res.metafieldDefinitionCreate.userErrors[0];
    if (err.message.includes("already taken")) return;
    throw new Error(err.message);
  }
}
