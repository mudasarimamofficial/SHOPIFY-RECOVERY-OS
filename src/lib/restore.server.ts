import type { SupabaseClient } from "@supabase/supabase-js";
import {
  makeShopifyClient,
  fetchShopInfo,
  type ShopifyClient,
  SHOPIFY_API_VERSION,
} from "./shopify.server";
import { AuthManager } from "./auth-manager.server";

interface StoreRow {
  id: string;
  user_id: string;
  shop_domain: string;
  access_token_ciphertext: string;
}

export type RestoreAction = "create" | "update" | "skip" | "conflict";

export interface RestorePlanItem {
  resource_type: string;
  action: RestoreAction;
  count: number;
  reason?: string;
}

export interface RestorePlan {
  backup_id: string;
  target_store_id: string;
  compatibility: {
    api_versions_match: boolean;
    source_api: string;
    target_api: string;
  };
  items: RestorePlanItem[];
}

export async function generateRestorePlan(
  admin: SupabaseClient,
  backupId: string,
  targetStore: StoreRow,
  selectedResources?: string[],
): Promise<RestorePlan> {
  const { data: backup, error } = await admin
    .from("backups")
    .select("manifest")
    .eq("id", backupId)
    .single();
  if (error || !backup) throw new Error("Backup not found");

  const manifest = backup.manifest as any;
  if (!manifest || (manifest.format !== "recovery/1" && manifest.format !== "recovery/2")) {
    throw new Error("Invalid or missing package manifest");
  }

  const client = await AuthManager.getUnifiedClient(admin, targetStore.id);

  // Verify API version compatibility
  const sourceApi = manifest.api_version || "unknown";
  const apiMatch = sourceApi === SHOPIFY_API_VERSION;

  if (manifest.store?.domain === targetStore.shop_domain) {
    throw new Error("A migration source and destination must be different stores.");
  }

  // For a real diff, we would fetch current counts from targetStore.
  // Here we do a lightweight preview based on what's in the package.
  const items: RestorePlanItem[] = [];

  // The Dependency Engine - Topological Sort of Shopify Resources
  // Resources must be created in this order to satisfy foreign key (GID) relationships
  const dependencyGraph = [
    { key: "shop", name: "Shop Settings" },
    { key: "locations", name: "Locations" },
    { key: "metaobject_definitions", name: "Metaobject Definitions" },
    { key: "metaobjects", name: "Metaobjects" },
    { key: "metafield_definitions", name: "Metafield Definitions" },
    { key: "products_bulk", name: "Products & Variants" },
    { key: "collections_bulk", name: "Collections" },
    { key: "menus", name: "Menus" },
    { key: "pages", name: "Pages" },
    { key: "blogs", name: "Blogs" },
    { key: "articles", name: "Articles" },
    { key: "navigation", name: "Navigation" },
    { key: "redirects", name: "Redirects" },
    { key: "markets", name: "Markets" },
    { key: "translations", name: "Translations" },
    { key: "policies", name: "Policies" },
    { key: "theme", name: "Theme Engine Assets" },
    { key: "customers_bulk", name: "Customers" },
    { key: "orders_bulk", name: "Orders" },
    { key: "third_party_apps", name: "Apps" },
  ];

  const dependencies: Record<string, string[]> = {
    metaobjects: ["metaobject_definitions"],
    products_bulk: ["locations", "metafield_definitions", "metaobjects"],
    collections_bulk: ["products_bulk"],
    articles: ["blogs"],
    navigation: ["menus", "pages", "collections_bulk", "products_bulk"],
    orders_bulk: ["customers_bulk", "products_bulk"],
    redirects: ["products_bulk", "collections_bulk", "pages"],
    markets: [],
    theme: [],
    third_party_apps: ["theme"]
  };

  // This list intentionally contains only handlers that are implemented and
  // fail closed. Unsupported resources remain visible in the plan as skips.
  const executable = new Set([
    "metafield_definitions",
    "metaobject_definitions",
    "metaobjects",
    "locations",
    "products_bulk",
    "collections_bulk",
    "pages",
    "blogs",
    "articles",
    "redirects",
    "customers_bulk",
  ]);
  const limitations: Record<string, string> = {
    shop: "Shop-level settings cannot be copied between stores without overwriting destination configuration.",
    orders_bulk:
      "Historical orders require a separate, scope- and plan-dependent import policy and are not executed by this release.",
    theme:
      "Theme asset migration has not passed checksum verification and is disabled for cross-store execution.",
  };

  const bulkAliases: Record<string, string> = {
    products: "products_bulk",
    collections: "collections_bulk",
    customers: "customers_bulk",
    orders: "orders_bulk",
    metaobjects: "metaobjects",
    metafields: "metafield_definitions",
  };
  const requested = new Set(
    (selectedResources && selectedResources.length > 0
      ? selectedResources
      : dependencyGraph.map((node) => node.key)
    ).map((key) => bulkAliases[key] ?? key),
  );

  const include = new Set<string>();
  const addWithDependencies = (key: string) => {
    if (include.has(key)) return;
    include.add(key);
    for (const dependency of dependencies[key] ?? []) addWithDependencies(dependency);
  };
  for (const key of requested) addWithDependencies(key);

  const catalog = manifest.catalog || [];

  for (const node of dependencyGraph) {
    if (!include.has(node.key)) continue;

    // Match against catalog - support both exact key and _bulk suffix
    const resource = catalog.find(
      (r: any) =>
        r.key === node.key ||
        r.key === node.key.replace("_bulk", "") ||
        node.key === r.key + "_bulk",
    );
    // Skip items not in manifest or with 0 count
    if (!resource || (resource.count !== undefined && resource.count === 0)) continue;

    items.push({
      resource_type: node.key,
      action: executable.has(node.key) ? "create" : "skip",
      count: resource.count ?? 1,
      reason: executable.has(node.key)
        ? "Cross-store create with persistent ID mapping."
        : (limitations[node.key] ?? "This resource has no verified cross-store restore handler."),
    });
  }

  return {
    backup_id: backupId,
    target_store_id: targetStore.id,
    compatibility: {
      api_versions_match: apiMatch,
      source_api: sourceApi,
      target_api: SHOPIFY_API_VERSION,
    },
    items,
  };
}

export async function executeRestoreStep(admin: SupabaseClient, jobId: string) {
  const { data: job, error } = await admin
    .from("restore_jobs")
    .select("*, target_store:stores(*)")
    .eq("id", jobId)
    .single();

  if (error || !job) throw new Error("Restore job not found");
  if (
    job.status === "completed" ||
    job.status === "completed_with_failures" ||
    job.status === "failed"
  ) {
    return { done: true, report: job.report, status: job.status };
  }

  try {
    const targetStore = job.target_store as StoreRow;
    const client = await AuthManager.getUnifiedClient(admin, targetStore.id);

    const plan = job.plan as RestorePlan;
    const progress = job.progress || 0;
    const reportData = (job.report || {}) as any;

    const currentItemIndex = reportData.currentItemIndex || 0;
    if (currentItemIndex >= plan.items.length) {
      // Done
      const finalStatus =
        (reportData.objectsFailed || 0) > 0 ? "completed_with_failures" : "completed";
      await admin
        .from("restore_jobs")
        .update({
          status: finalStatus,
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      await admin.from("activity_log").insert({
        user_id: job.user_id,
        store_id: targetStore.id,
        kind: "restore",
        title: `Restore ${finalStatus} · ${targetStore.shop_domain}`,
        detail: `Processed ${plan.items.length} planned resources; ${reportData.objectsFailed || 0} objects failed.`,
      });

      return { done: true, report: reportData, status: finalStatus };
    }

    const item = plan.items[currentItemIndex];

    if (item.action === "skip") {
      const nextItemIndex = currentItemIndex + 1;
      const updatedReport = {
        ...reportData,
        currentItemIndex: nextItemIndex,
        skippedResources: [
          ...(reportData.skippedResources || []),
          { resource_type: item.resource_type, count: item.count, reason: item.reason },
        ],
      };
      const nextProgress = Math.min(99, Math.round((nextItemIndex / plan.items.length) * 100));
      await admin
        .from("restore_jobs")
        .update({ progress: nextProgress, report: updatedReport })
        .eq("id", jobId);
      return {
        done: false,
        progress: nextProgress,
        current_resource: `${item.resource_type} (skipped)`,
        report: updatedReport,
      };
    }

    const extension = item.resource_type.endsWith("_bulk") ? "jsonl" : "json";
    // Download data from Supabase Storage
    const { data: fileData, error: downloadErr } = await admin.storage
      .from("recovery_packages")
      .download(`${job.backup_id}/${item.resource_type.replace("_bulk", "")}.${extension}`);

    if (downloadErr || !fileData) {
      throw new Error(
        `Required backup payload is unavailable for ${item.resource_type}: ${downloadErr?.message ?? "missing file"}`,
      );
    }

    const gidMap = reportData.gidMap || {};
    const currentOffset = reportData.currentOffset || 0;

    let CHUNK_SIZE = 150;
    if (item.resource_type === "orders_bulk") {
      CHUNK_SIZE = 8; // orders are REST POSTs, which are rate-limited and slow (keep small to avoid 504 timeouts)
    } else if (item.resource_type === "products_bulk") {
      CHUNK_SIZE = 50; // products can have heavy option schemas
    } else if (item.resource_type === "customers_bulk") {
      CHUNK_SIZE = 75; // customers are fast but email deduplication queries take time
    }

    let successCount = 0;
    let failureCount = 0;
    let totalItems = 0;
    let processedCount = 0;
    let failedKeys: any[] = [];

    // Instantiate ID Mapper
    const { IdMapper } = await import("./pipeline/id-mapper");
    const idMapper = new IdMapper(admin, jobId, job.user_id);

    if (fileData) {
      // Import the executor we built
      const { executeResourceRestore } = await import("./sdk/recovery/executor");

      // Execute real restore using streaming blob
      const res = await executeResourceRestore(
        client,
        item.resource_type,
        item.action,
        fileData,
        item.action === "update", // if action is update, we assume isSameStore logic
        idMapper,
        currentOffset,
        CHUNK_SIZE,
      );
      successCount = res.successCount;
      failureCount = res.failureCount;
      failedKeys = res.failedKeys || [];
      totalItems = res.totalItems;
      processedCount = res.processedCount;
    } else {
      console.log(`Skipped missing resource ${item.resource_type}`);
    }

    console.log(
      `Restore step ${item.resource_type}: ${successCount} success, ${failureCount} failed.`,
    );

    const absoluteProcessed = currentOffset + processedCount;
    const hasMore = fileData && absoluteProcessed < totalItems;

    let nextProgress = progress;
    const updatedReport = { ...reportData, gidMap };

    // Aggregate success and failure metrics
    updatedReport.objectsRestored = (updatedReport.objectsRestored || 0) + successCount;
    updatedReport.objectsFailed = (updatedReport.objectsFailed || 0) + failureCount;
    updatedReport.failedItems = [...(updatedReport.failedItems || []), ...failedKeys];

    // Simulate real-time tracking (since true real-time needs GraphQL interception)
    updatedReport.liveRestRequests = (updatedReport.liveRestRequests || 0) + processedCount;
    updatedReport.liveGraphqlCost = (updatedReport.liveGraphqlCost || 0) + processedCount * 10;

    if (hasMore) {
      updatedReport.currentOffset = absoluteProcessed;
      updatedReport.currentItemIndex = currentItemIndex;
      // Calculate intra-item progress
      const stepWeight = 100 / plan.items.length;
      const progressFraction = (absoluteProcessed / totalItems) * stepWeight;
      nextProgress = Math.min(
        99,
        Math.round((currentItemIndex / plan.items.length) * 100 + progressFraction),
      );
    } else {
      // Completed this resource stage
      const nextItemIndex = currentItemIndex + 1;
      updatedReport.currentItemIndex = nextItemIndex;
      delete updatedReport.currentOffset;
      nextProgress = Math.min(99, Math.round((nextItemIndex / plan.items.length) * 100));
    }

    await admin
      .from("restore_jobs")
      .update({
        progress: nextProgress,
        report: updatedReport,
      })
      .eq("id", jobId);

    const resourceLabel = hasMore
      ? `${item.resource_type} (${absoluteProcessed}/${totalItems})`
      : item.resource_type;

    return {
      done: false,
      progress: nextProgress,
      current_resource: resourceLabel,
      report: updatedReport,
    };
  } catch (err: any) {
    await admin
      .from("restore_jobs")
      .update({
        status: "failed",
      })
      .eq("id", jobId);

    await admin.from("activity_log").insert({
      user_id: job.user_id,
      store_id: job.target_store_id,
      kind: "restore",
      title: `Restore failed: ${err.message}`,
      detail: `Stack: ${err.stack}`,
    });

    throw err;
  }
}
