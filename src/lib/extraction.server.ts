import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchShopInfo,
  SHOPIFY_API_VERSION,
  type ShopifyClient,
} from "./shopify.server";
import { AuthManager } from "./auth-manager.server";
import { RESOURCE_CATALOG } from "./resource-catalog";

interface StoreRow {
  id: string;
  user_id: string;
  shop_domain: string;
  access_token_ciphertext: string;
}

// Order of execution
import { createHash } from "node:crypto";

const SCAN_STAGES = [
  "shop",
  "locations",
  "collections_bulk",
  "pages",
  "blogs",
  "articles",
  "redirects",
  "policies",
  "theme",
  "metafield_definitions",
  "metaobject_definitions",
  "metaobjects",
  "products_bulk",
  "customers_bulk",
  "orders_bulk",
  "domains",
  "shipping",
  "markets",
  "third_party_apps",
  "payments",
  "menus",
  "translations",
  "web_pixels",
  "finalize",
];

async function uploadToStorage(admin: SupabaseClient, path: string, data: string | Buffer | Blob) {
  let payload: Buffer | Blob;
  let hash = "stream-no-hash";

  if (data instanceof Blob) {
    // Supabase bucket strictly rejects application/jsonl (which Shopify returns for Bulk API).
    // We forcefully coerce the blob's native type so the Supabase SDK doesn't override our contentType header.
    payload =
      data.type === "application/jsonl" || data.type === ""
        ? new Blob([data], { type: "application/octet-stream" })
        : data;
  } else {
    payload = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    hash = createHash("sha256").update(payload).digest("hex");
  }

  const startTime = performance.now();
  const { error } = await admin.storage
    .from("recovery_packages")
    .upload(path, payload, { contentType: "application/octet-stream", upsert: true });

  const executionTime = Math.round(performance.now() - startTime);
  const size = payload instanceof Blob ? payload.size : payload.length;
  console.log(
    `[FORENSIC-STORAGE] PATH: ${path} | SIZE: ${size}b | TIME: ${executionTime}ms | BLOB: ${payload instanceof Blob} | SUCCESS: ${!error}`,
  );

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return hash;
}

async function runRestStage(
  client: ShopifyClient,
  stageKey: string,
  admin?: SupabaseClient,
  backupId?: string,
) {
  switch (stageKey) {
    case "shop":
      return { count: 1, data: await fetchShopInfo(client) };
    case "locations":
      return { count: -1, data: await client.paged("/locations.json", "locations") };
    case "pages":
      return { count: -1, data: await client.paged("/pages.json", "pages") };
    case "blogs":
      return { count: -1, data: await client.paged("/blogs.json", "blogs") };
    case "articles":
      const blogs = await client.paged<{ id: number }>("/blogs.json", "blogs").catch(() => []);
      const allArgs: unknown[] = [];
      for (const b of blogs) {
        const arts = await client.paged(`/blogs/${b.id}/articles.json`, "articles").catch(() => []);
        allArgs.push(...arts);
      }
      return { count: allArgs.length, data: allArgs };
    case "redirects":
      return { count: -1, data: await client.paged("/redirects.json", "redirects") };
    case "policies":
      const { policies } = await client.rest<{ policies: unknown[] }>("/policies.json");
      return { count: policies.length, data: policies };
    case "metafield_definitions": {
      const allMetafields = [];
      const ownerTypes = [
        "PRODUCT",
        "COLLECTION",
        "CUSTOMER",
        "ORDER",
        "PAGE",
        "BLOG",
        "ARTICLE",
        "SHOP",
        "COMPANY",
        "LOCATION",
        "PRODUCTVARIANT",
      ];
      for (const owner of ownerTypes) {
        const queryBuilder = (cursor: string | null) =>
          `{ metafieldDefinitions(first: 250, ownerType: ${owner}${cursor ? `, after: "${cursor}"` : ""}) { pageInfo { hasNextPage endCursor } edges { node { id name namespace key description type validationStatus validations { name value } } } } }`;
        const mfs = await client.paginateGraphQL(queryBuilder, ["metafieldDefinitions"]);
        allMetafields.push(...mfs);
      }
      return { count: allMetafields.length, data: allMetafields };
    }
    case "metaobject_definitions": {
      const queryBuilder = (cursor: string | null) =>
        `{ metaobjectDefinitions(first: 250${cursor ? `, after: "${cursor}"` : ""}) { pageInfo { hasNextPage endCursor } edges { node { id type name description access { admin store } capabilities { publishable { enabled } translatable { enabled } } fieldDefinitions { key name type required description validations { name value } } } } } }`;
      const allDefs = await client.paginateGraphQL(queryBuilder, ["metaobjectDefinitions"]);
      return { count: allDefs.length, data: allDefs };
    }
    case "metaobjects": {
      if (!admin || !backupId)
        throw new Error("Metaobjects requires admin and backupId to load definitions");
      const { data: fileData, error } = await admin.storage
        .from("recovery_packages")
        .download(`${backupId}/metaobject_definitions.json`);
      if (error || !fileData)
        throw new Error("Could not load metaobject_definitions for metaobjects stage");
      const defs = JSON.parse(await fileData.text());
      const allObjects = [];
      for (const def of defs) {
        const queryBuilder = (cursor: string | null) =>
          `{ metaobjects(type: "${def.type}", first: 250${cursor ? `, after: "${cursor}"` : ""}) { pageInfo { hasNextPage endCursor } edges { node { id handle type capabilities { publishable { status } } fields { key value } } } } }`;
        const objs = await client.paginateGraphQL(queryBuilder, ["metaobjects"]);
        allObjects.push(...objs);
      }
      return { count: allObjects.length, data: allObjects };
    }
    case "domains": {
      const q = `{ shop { primaryDomain { url host } } }`;
      const res = await client.graphql<{ shop: any }>(q);
      return { count: 1, data: res.shop };
    }
    case "shipping": {
      const q = `{ deliveryProfiles(first: 50) { edges { node { id name default profileLocationGroups { locationGroup { id } } zoneCountryCount } } } }`;
      const res = await client.graphql<{ deliveryProfiles: any }>(q);
      return {
        count: res.deliveryProfiles.edges.length,
        data: res.deliveryProfiles.edges.map((e: any) => e.node),
      };
    }
    case "markets": {
      const q = `{ markets(first: 50) { edges { node { id name handle enabled primary } } } }`;
      const res = await client.graphql<{ markets: any }>(q);
      return { count: res.markets.edges.length, data: res.markets.edges.map((e: any) => e.node) };
    }
    case "third_party_apps": {
      const q = `{ appInstallations(first: 100) { edges { node { id app { title developerName } } } } }`;
      const res = await client.graphql<{ appInstallations: any }>(q);
      return {
        count: res.appInstallations.edges.length,
        data: res.appInstallations.edges.map((e: any) => e.node),
      };
    }
    case "payments": {
      const q = `{ shop { name primaryDomain { url } myshopifyDomain } }`;
      const res = await client.graphql<{ shop: any }>(q);
      return { count: 1, data: res.shop?.paymentSettings || {} };
    }
    case "menus": {
      const q = `{ menus(first: 50) { edges { node { id title handle items { title url type } } } } }`;
      const res = await client.graphql<{ menus: any }>(q);
      return { count: res.menus.edges.length, data: res.menus.edges.map((e: any) => e.node) };
    }
    case "translations": {
      const q = `{ shopLocales { locale name primary published } }`;
      const res = await client.graphql<{ shopLocales: any }>(q);
      return { count: res.shopLocales.length, data: res.shopLocales };
    }
    case "web_pixels": {
      const q = `{ webPixelEvents(first: 50) { edges { node { id title } } } }`;
      const res = await client.graphql<any>(q).catch(() => ({ webPixelEvents: { edges: [] } }));
      return {
        count: res.webPixelEvents?.edges?.length || 0,
        data: res.webPixelEvents?.edges?.map((e: any) => e.node) || [],
      };
    }
    default:
      throw new Error(`Unknown REST stage: ${stageKey}`);
  }
}

async function startBulkOperation(client: ShopifyClient, query: string) {
  const gql = `
    mutation {
      bulkOperationRunQuery(
        query: """${query}"""
      ) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }
  `;
  const res = await client.graphql<{ bulkOperationRunQuery: any }>(gql);
  const errors = res.bulkOperationRunQuery.userErrors;
  if (errors && errors.length > 0) {
    if (errors[0].message.includes("already in progress")) {
      const current = await pollBulkOperation(client);
      if (current?.id && current.status === "RUNNING") {
        await client.graphql(
          `mutation { bulkOperationCancel(id: "${current.id}") { bulkOperation { id } } }`,
        );
        await new Promise((r) => setTimeout(r, 2000));
        const retryRes = await client.graphql<{ bulkOperationRunQuery: any }>(gql);
        const retryErrors = retryRes.bulkOperationRunQuery.userErrors;
        if (retryErrors && retryErrors.length > 0) throw new Error(retryErrors[0].message);
        return retryRes.bulkOperationRunQuery.bulkOperation.id;
      }
    }
    throw new Error(errors[0].message);
  }
  return res.bulkOperationRunQuery.bulkOperation.id;
}

async function pollBulkOperation(client: ShopifyClient) {
  const gql = `
    query {
      currentBulkOperation {
        id status errorCode url objectCount fileSize
      }
    }
  `;
  const res = await client.graphql<{ currentBulkOperation: any }>(gql);
  return res.currentBulkOperation;
}

export async function stepBackup(admin: SupabaseClient, store: StoreRow, backupId: string) {
  const { data: backup, error: backupErr } = await admin
    .from("backups")
    .select("current_stage, progress, package_data, resources_completed, errors_count")
    .eq("id", backupId)
    .single();

  if (backupErr || !backup) throw new Error("Backup not found");

  const currentStage = backup.current_stage || SCAN_STAGES[0];
  const stageIndex = SCAN_STAGES.indexOf(currentStage);
  const state = (backup.package_data as any) || {};

  if (currentStage === "finalize") {
    // Fetch real counts from backup_resources
    const { data: resourceRows } = await admin
      .from("backup_resources")
      .select("resource_type, count, recoverability")
      .eq("backup_id", backupId)
      .eq("status", "completed");

    const countMap: Record<string, number> = {};
    for (const row of resourceRows ?? []) {
      countMap[row.resource_type] = row.count ?? 0;
    }

    // Generate manifest with real counts
    const manifest = {
      format: "recovery/2",
      generated_at: new Date().toISOString(),
      api_version: SHOPIFY_API_VERSION,
      store: { domain: store.shop_domain },
      catalog: RESOURCE_CATALOG.filter((r) => r.scanned).map((r) => ({
        key: r.key,
        recoverability: r.recoverability,
        scanned: true,
        count: countMap[r.key] ?? countMap[r.key.replace("_bulk", "")] ?? 0,
      })),
      checksums: state.checksums || {},
    };
    await uploadToStorage(admin, `${backupId}/recovery.json`, JSON.stringify(manifest, null, 2));

    await admin
      .from("backups")
      .update({
        status: "completed",
        progress: 100,
        current_stage: "done",
        completed_at: new Date().toISOString(),
        manifest: manifest,
      })
      .eq("id", backupId);

    await admin.from("activity_log").insert({
      user_id: store.user_id,
      store_id: store.id,
      kind: "backup",
      title: `Backup completed · ${store.shop_domain}`,
      detail: `Package saved to secure storage.`,
    });
    return { done: true };
  }

  const client = await AuthManager.getUnifiedClient(admin, store.id);

  try {
    if (currentStage.endsWith("_bulk")) {
      const resource = currentStage.split("_")[0]; // products, customers, orders

      if (!state.bulk_op_id) {
        // Start bulk operation
        let query = "";
        if (resource === "products") {
          query = `{ products { edges { node { id title handle descriptionHtml vendor productType createdAt updatedAt tags status options { name values } media(first: 10) { edges { node { alt mediaContentType ...on MediaImage { image { url altText } } ...on Video { sources { url } } } } } variants { edges { node { id title sku price taxable barcode compareAtPrice inventoryPolicy inventoryItem { id requiresShipping measurement { weight { value unit } } inventoryLevels(first: 10) { edges { node { id available quantities(names: ["available"]) { name quantity } location { id } } } } } selectedOptions { name value } } } } } } } }`;
        } else if (resource === "customers") {
          query = `{ customers { edges { node { id firstName lastName email phone createdAt updatedAt note tags state } } } }`;
        } else if (resource === "orders") {
          query = `{ orders { edges { node { id name email phone createdAt updatedAt displayFinancialStatus displayFulfillmentStatus note tags customer { id } lineItems { edges { node { id title quantity variant { id } product { id } } } } } } } }`;
        } else if (resource === "collections") {
          query = `{ collections { edges { node { id title handle descriptionHtml updatedAt sortOrder templateSuffix ruleSet { appliedDisjunctively rules { column condition relation } } products { edges { node { id } } } } } } }`;
        } else if (resource === "metaobject_definitions") {
          query = `{ metaobjectDefinitions { edges { node { id type name description access { admin store } capabilities { publishable { enabled } translatable { enabled } } fieldDefinitions { key name type required description validations { name value } } } } } }`;
        } else if (resource === "metaobjects") {
          query = `{ metaobjects { edges { node { id handle type capabilities { publishable { status } } fields { key value } } } } }`;
        }

        const opId = await startBulkOperation(client, query);
        state.bulk_op_id = opId;
        await admin.from("backups").update({ package_data: state }).eq("id", backupId);
        return { done: false, stage: currentStage, status: "polling" };
      } else {
        // Poll bulk operation
        const op = await pollBulkOperation(client);
        if (op?.status === "COMPLETED") {
          const count = op.objectCount || 0;
          if (op.url) {
            const fileRes = await fetch(op.url);
            if (!fileRes.ok) throw new Error("Failed to download bulk result");
            const blob = await fileRes.blob();
            const hash = await uploadToStorage(admin, `${backupId}/${resource}.jsonl`, blob);
            state.checksums = state.checksums || {};
            state.checksums[`${resource}.jsonl`] = hash;
          }

          await admin.from("backup_resources").insert({
            backup_id: backupId,
            user_id: store.user_id,
            resource_type: resource,
            status: "completed",
            count,
            recoverability: resource === "orders" ? "partial" : "full",
          });

          delete state.bulk_op_id;
          const nextStage = SCAN_STAGES[stageIndex + 1];
          await admin
            .from("backups")
            .update({
              current_stage: nextStage,
              package_data: state,
              progress: Math.round(((stageIndex + 1) / SCAN_STAGES.length) * 100),
              resources_completed: backup.resources_completed + 1,
            })
            .eq("id", backupId);
          return { done: false, stage: currentStage, status: "completed" };
        } else if (op?.status === "FAILED" || op?.status === "CANCELED") {
          throw new Error(`Bulk operation ${op.status}`);
        } else {
          // Still running
          return { done: false, stage: currentStage, status: "polling" };
        }
      }
    } else if (currentStage === "theme") {
      // Chunked theme asset download
      const { runWithConcurrency } = await import("./shopify.server");

      let assetKeys = state.theme_asset_keys;
      let activeThemeId = state.theme_active_id;
      const downloadedAssets = state.theme_assets || [];

      if (!assetKeys) {
        // Initial fetch of theme metadata and asset list
        const { themes } = await client.rest<{
          themes: Array<{ id: number; role: string; name: string }>;
        }>("/themes.json");
        const active = themes.find((t) => t.role === "main") ?? themes[0];
        if (!active) {
          // No themes found
          await admin.from("backup_resources").insert({
            backup_id: backupId,
            user_id: store.user_id,
            resource_type: currentStage,
            status: "completed",
            count: 0,
            recoverability: "full",
          });
          const nextStage = SCAN_STAGES[stageIndex + 1];
          await admin
            .from("backups")
            .update({
              current_stage: nextStage,
              progress: Math.round(((stageIndex + 1) / SCAN_STAGES.length) * 100),
            })
            .eq("id", backupId);
          return { done: false, stage: currentStage, status: "completed" };
        }

        activeThemeId = active.id;
        state.theme_metadata = active;
        const { assets } = await client.rest<{ assets: Array<{ key: string }> }>(
          `/themes/${active.id}/assets.json`,
        );
        assetKeys = assets.map((a) => a.key);
        state.theme_asset_keys = assetKeys;
        state.theme_active_id = activeThemeId;
        state.theme_assets = [];
        await admin.from("backups").update({ package_data: state }).eq("id", backupId);
        return { done: false, stage: currentStage, status: "polling", progress: 0 };
      }

      // Process a chunk of assets
      const BATCH_SIZE = 40; // Approx 20 seconds at 2 req/sec
      const offset = downloadedAssets.length;
      const keysToProcess = assetKeys.slice(offset, offset + BATCH_SIZE);

      if (keysToProcess.length > 0) {
        const fetchAsset = async (key: string) => {
          const res = await client
            .rest<{ asset: any }>(
              `/themes/${activeThemeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
            )
            .catch((e) => {
              console.warn(`Failed to fetch asset ${key}:`, e);
              return { asset: { key } }; // fallback to empty
            });
          return res.asset;
        };

        const batch = await runWithConcurrency(keysToProcess, 5, fetchAsset);
        downloadedAssets.push(...batch);
        state.theme_assets = downloadedAssets;
        await admin.from("backups").update({ package_data: state }).eq("id", backupId);

        return {
          done: false,
          stage: currentStage,
          status: "polling",
          progress: Math.round((downloadedAssets.length / assetKeys.length) * 100),
        };
      } else {
        // Finished downloading all assets
        const finalData = { theme: state.theme_metadata, assets: downloadedAssets };
        const hash = await uploadToStorage(
          admin,
          `${backupId}/theme.json`,
          JSON.stringify(finalData, null, 2),
        );

        state.checksums = state.checksums || {};
        state.checksums[`theme.json`] = hash;

        // Clean up large arrays from DB state
        delete state.theme_asset_keys;
        delete state.theme_assets;
        delete state.theme_metadata;
        delete state.theme_active_id;

        await admin.from("backup_resources").insert({
          backup_id: backupId,
          user_id: store.user_id,
          resource_type: currentStage,
          status: "completed",
          count: 1 + downloadedAssets.length,
          recoverability: "full",
        });

        const nextStage = SCAN_STAGES[stageIndex + 1];
        await admin
          .from("backups")
          .update({
            current_stage: nextStage,
            package_data: state,
            progress: Math.round(((stageIndex + 1) / SCAN_STAGES.length) * 100),
            resources_completed: backup.resources_completed + 1,
          })
          .eq("id", backupId);

        return { done: false, stage: currentStage, status: "completed" };
      }
    } else {
      // Standard REST stage
      const { count, data } = await runRestStage(client, currentStage, admin, backupId);
      const actualCount = count === -1 ? (Array.isArray(data) ? data.length : 0) : count;

      if (data) {
        const hash = await uploadToStorage(
          admin,
          `${backupId}/${currentStage}.json`,
          JSON.stringify(data, null, 2),
        );
        state.checksums = state.checksums || {};
        state.checksums[`${currentStage}.json`] = hash;
      }

      await admin.from("backup_resources").insert({
        backup_id: backupId,
        user_id: store.user_id,
        resource_type: currentStage,
        status: "completed",
        count: actualCount,
        recoverability: "full",
      });

      const nextStage = SCAN_STAGES[stageIndex + 1];
      await admin
        .from("backups")
        .update({
          current_stage: nextStage,
          progress: Math.round(((stageIndex + 1) / SCAN_STAGES.length) * 100),
          resources_completed: backup.resources_completed + 1,
        })
        .eq("id", backupId);

      return { done: false, stage: currentStage, status: "completed" };
    }
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    await admin.from("backup_resources").insert({
      backup_id: backupId,
      user_id: store.user_id,
      resource_type: currentStage,
      status: "failed",
      count: 0,
      recoverability: "full",
      error: errorMsg,
    });

    // Move to next stage despite error (fault tolerant)
    delete state.bulk_op_id;
    const nextStage = SCAN_STAGES[stageIndex + 1];
    await admin
      .from("backups")
      .update({
        current_stage: nextStage,
        package_data: state,
        errors_count: backup.errors_count + 1,
        progress: Math.round(((stageIndex + 1) / SCAN_STAGES.length) * 100),
      })
      .eq("id", backupId);

    return { done: false, stage: currentStage, status: "error", error: errorMsg };
  }
}
