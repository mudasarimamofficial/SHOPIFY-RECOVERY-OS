import type { SupabaseClient } from "@supabase/supabase-js";
import { makeShopifyClient, decryptToken, fetchShopInfo, SHOPIFY_API_VERSION, type ShopifyClient } from "./shopify.server";
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
  "shop", "locations", "collections", "pages", "blogs", "articles", 
  "redirects", "policies", "theme",
  "products_bulk", "customers_bulk", "orders_bulk", "finalize"
];

async function uploadToStorage(admin: SupabaseClient, path: string, data: string | Buffer) {
  const payload = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  const hash = createHash("sha256").update(payload).digest("hex");
  
  const { error } = await admin.storage
    .from("recovery_packages")
    .upload(path, payload, { contentType: "application/json", upsert: true });
    
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return hash;
}

async function runRestStage(client: ShopifyClient, stageKey: string) {
  switch (stageKey) {
    case "shop":
      return { count: 1, data: await fetchShopInfo(client) };
    case "locations":
      return { count: -1, data: await client.paged("/locations.json", "locations") };
    case "collections":
      const custom = await client.paged("/custom_collections.json", "custom_collections").catch(() => []);
      const smart = await client.paged("/smart_collections.json", "smart_collections").catch(() => []);
      return { count: custom.length + smart.length, data: { custom, smart } };
    case "pages":
      return { count: -1, data: await client.paged("/pages.json", "pages") };
    case "blogs":
      return { count: -1, data: await client.paged("/blogs.json", "blogs") };
    case "articles":
      const blogs = await client.paged<{ id: number }>("/blogs.json", "blogs").catch(() => []);
      const allArgs: unknown[] = [];
      for (const b of blogs.slice(0, 20)) {
        const arts = await client.paged(`/blogs/${b.id}/articles.json`, "articles").catch(() => []);
        allArgs.push(...arts);
      }
      return { count: allArgs.length, data: allArgs };
    case "redirects":
      return { count: -1, data: await client.paged("/redirects.json", "redirects") };
    case "policies":
      const { policies } = await client.rest<{ policies: unknown[] }>("/policies.json");
      return { count: policies.length, data: policies };
    case "theme":
      const { themes } = await client.rest<{ themes: Array<{ id: number; role: string; name: string }> }>("/themes.json");
      const active = themes.find((t) => t.role === "main") ?? themes[0];
      if (!active) return { count: 0, data: null };
      const { assets } = await client.rest<{ assets: Array<{ key: string }> }>(`/themes/${active.id}/assets.json`);
      return { count: 1 + assets.length, data: { theme: active, assets } };
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
  if (errors && errors.length > 0) throw new Error(errors[0].message);
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
  
  if (currentStage === "finalize") {
    // Generate manifest
    const manifest = {
      format: "recovery/2",
      generated_at: new Date().toISOString(),
      api_version: SHOPIFY_API_VERSION,
      store: { domain: store.shop_domain },
      catalog: RESOURCE_CATALOG.map((r) => ({ key: r.key, recoverability: r.recoverability, scanned: !!r.scanned })),
      checksums: state.checksums || {},
    };
    await uploadToStorage(admin, `${backupId}/recovery.json`, JSON.stringify(manifest, null, 2));
    
    await admin.from("backups").update({
      status: "completed",
      progress: 100,
      current_stage: "done",
      completed_at: new Date().toISOString(),
    }).eq("id", backupId);
    
    await admin.from("activity_log").insert({
      user_id: store.user_id,
      store_id: store.id,
      kind: "backup",
      title: `Backup completed · ${store.shop_domain}`,
      detail: `Package saved to secure storage.`,
    });
    return { done: true };
  }

  const token = decryptToken(store.access_token_ciphertext);
  const client = makeShopifyClient(store.shop_domain, token);
  let state = (backup.package_data as any) || {};

  try {
    if (currentStage.endsWith("_bulk")) {
      const resource = currentStage.split("_")[0]; // products, customers, orders
      
      if (!state.bulk_op_id) {
        // Start bulk operation
        let query = "";
        if (resource === "products") {
          query = `{ products { edges { node { id title handle descriptionHtml vendor productType createdAt updatedAt tags status variants { edges { node { id title sku price inventoryQuantity } } } } } } }`;
        } else if (resource === "customers") {
          query = `{ customers { edges { node { id firstName lastName email phone createdAt updatedAt note tags state } } } }`;
        } else if (resource === "orders") {
          query = `{ orders { edges { node { id name email displayFinancialStatus displayFulfillmentStatus createdAt totalPriceSet { shopMoney { amount currencyCode } } } } } }`;
        }
        
        const opId = await startBulkOperation(client, query);
        state.bulk_op_id = opId;
        await admin.from("backups").update({ package_data: state }).eq("id", backupId);
        return { done: false, stage: currentStage, status: "polling" };
      } else {
        // Poll bulk operation
        const op = await pollBulkOperation(client);
        if (op?.status === "COMPLETED") {
          let count = op.objectCount || 0;
          if (op.url) {
            const fileRes = await fetch(op.url);
            if (!fileRes.ok) throw new Error("Failed to download bulk result");
            const buffer = await fileRes.arrayBuffer();
            const hash = await uploadToStorage(admin, `${backupId}/${resource}.jsonl`, Buffer.from(buffer));
            state.checksums = state.checksums || {};
            state.checksums[`${resource}.jsonl`] = hash;
          }
          
          await admin.from("backup_resources").insert({
            backup_id: backupId, user_id: store.user_id, resource_type: resource,
            status: "completed", count, recoverability: resource === "orders" ? "partial" : "full",
          });
          
          delete state.bulk_op_id;
          const nextStage = SCAN_STAGES[stageIndex + 1];
          await admin.from("backups").update({
            current_stage: nextStage,
            package_data: state,
            progress: Math.round(((stageIndex + 1) / SCAN_STAGES.length) * 100),
            resources_completed: backup.resources_completed + 1
          }).eq("id", backupId);
          return { done: false, stage: currentStage, status: "completed" };
        } else if (op?.status === "FAILED" || op?.status === "CANCELED") {
          throw new Error(`Bulk operation ${op.status}`);
        } else {
          // Still running
          return { done: false, stage: currentStage, status: "polling" };
        }
      }
    } else {
      // Standard REST stage
      const { count, data } = await runRestStage(client, currentStage);
      const actualCount = count === -1 ? (Array.isArray(data) ? data.length : 0) : count;
      
      if (data) {
        const hash = await uploadToStorage(admin, `${backupId}/${currentStage}.json`, JSON.stringify(data, null, 2));
        state.checksums = state.checksums || {};
        state.checksums[`${currentStage}.json`] = hash;
      }
      
      await admin.from("backup_resources").insert({
        backup_id: backupId, user_id: store.user_id, resource_type: currentStage,
        status: "completed", count: actualCount, recoverability: "full",
      });
      
      const nextStage = SCAN_STAGES[stageIndex + 1];
      await admin.from("backups").update({
        current_stage: nextStage,
        progress: Math.round(((stageIndex + 1) / SCAN_STAGES.length) * 100),
        resources_completed: backup.resources_completed + 1
      }).eq("id", backupId);
      
      return { done: false, stage: currentStage, status: "completed" };
    }
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    await admin.from("backup_resources").insert({
      backup_id: backupId, user_id: store.user_id, resource_type: currentStage,
      status: "failed", count: 0, recoverability: "full", error: errorMsg,
    });
    
    // Move to next stage despite error (fault tolerant)
    delete state.bulk_op_id;
    const nextStage = SCAN_STAGES[stageIndex + 1];
    await admin.from("backups").update({
      current_stage: nextStage,
      package_data: state,
      errors_count: backup.errors_count + 1,
      progress: Math.round(((stageIndex + 1) / SCAN_STAGES.length) * 100),
    }).eq("id", backupId);
    
    return { done: false, stage: currentStage, status: "error", error: errorMsg };
  }
}
