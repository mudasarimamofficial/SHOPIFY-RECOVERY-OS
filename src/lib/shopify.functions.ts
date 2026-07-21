import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const connectSchema = z.object({
  shop_domain: z.string().min(3).max(200),
  access_token: z.string().min(10).max(500),
});

export const connectShopifyStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => connectSchema.parse(v))
  .handler(async ({ data, context }) => {
    const {
      makeShopifyClient,
      fetchShopInfo,
      encryptToken,
      normalizeShopDomain,
      SHOPIFY_API_VERSION,
    } = await import("@/lib/shopify.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const domain = normalizeShopDomain(data.shop_domain);
    const client = makeShopifyClient(domain, data.access_token);

    // Verify access with /shop.json
    let shop;
    try {
      shop = await fetchShopInfo(client);
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `Could not connect: ${err.message}`
          : "Could not connect to Shopify.",
      );
    }

    const ciphertext = encryptToken(data.access_token);
    const { data: row, error } = await supabaseAdmin
      .from("stores")
      .upsert(
        {
          user_id: context.userId,
          shop_domain: domain,
          name: shop.name,
          plan: shop.plan_display_name ?? shop.plan_name,
          country: shop.country_name,
          currency: shop.currency,
          email: shop.email,
          api_version: SHOPIFY_API_VERSION,
          access_token_ciphertext: ciphertext,
          status: "connected",
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,shop_domain" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("activity_log").insert({
      user_id: context.userId,
      store_id: row.id,
      kind: "connect",
      title: `Connected ${domain}`,
      detail: `Plan: ${shop.plan_display_name ?? shop.plan_name ?? "—"}`,
    });

    return { store: { id: row.id, shop_domain: row.shop_domain, name: row.name } };
  });

// Official OAuth entrypoint. Authenticated: binds the pending install to the
// current app user via a one-time state row, then returns the Shopify
// authorization URL for the browser to redirect to.
export const beginShopifyOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ shop_domain: z.string().min(3).max(200) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeShop, isValidShopDomain, generateState, buildAuthorizeUrl } =
      await import("@/lib/shopify-oauth.server");

    const shop = normalizeShop(data.shop_domain);
    if (!isValidShopDomain(shop)) {
      throw new Error("Enter a valid domain like my-store.myshopify.com");
    }

    const state = generateState();
    const { error } = await supabaseAdmin.from("oauth_sessions").insert({
      state,
      user_id: context.userId,
      shop_domain: shop,
    });
    if (error) throw new Error(`Could not start Shopify authorization: ${error.message}`);

    return { authorizeUrl: buildAuthorizeUrl(shop, state), shop };
  });

export const listStores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("stores")
      .select(
        "id, shop_domain, name, plan, country, currency, api_version, status, last_synced_at, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: store, error } = await context.supabase
      .from("stores")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return store;
  });

export const deleteStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const startBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) =>
    z.object({ store_id: z.string().uuid(), label: z.string().max(120).optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: store, error: storeErr } = await context.supabase
      .from("stores")
      .select("id, user_id, shop_domain, access_token_ciphertext")
      .eq("id", data.store_id)
      .maybeSingle();
    if (storeErr || !store) throw new Error("Store not found");

    const { data: backup, error: backupErr } = await supabaseAdmin
      .from("backups")
      .insert({
        user_id: context.userId,
        store_id: store.id,
        label: data.label ?? `Snapshot ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
        status: "running",
        current_stage: "shop",
        progress: 0,
        package_data: {},
      })
      .select("id")
      .single();
    if (backupErr) throw new Error(backupErr.message);

    return { backup_id: backup.id };
  });

export const stepBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ backup_id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { stepBackup } = await import("@/lib/backup.server");

    const { data: backup, error: backupErr } = await context.supabase
      .from("backups")
      .select("store_id")
      .eq("id", data.backup_id)
      .maybeSingle();
    if (backupErr || !backup) throw new Error("Backup not found");

    const { data: store, error: storeErr } = await supabaseAdmin
      .from("stores")
      .select("id, user_id, shop_domain, access_token_ciphertext")
      .eq("id", backup.store_id)
      .maybeSingle();
    if (storeErr || !store) throw new Error("Store not found");

    return await stepBackup(supabaseAdmin, store, data.backup_id);
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("backups")
      .select(
        "id, label, status, progress, current_stage, recovery_score, resources_total, resources_completed, errors_count, size_bytes, started_at, completed_at, created_at, store_id, stores(shop_domain, name)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getBackup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: backup, error } = await context.supabase
      .from("backups")
      .select(
        "id, label, status, progress, current_stage, recovery_score, resources_total, resources_completed, errors_count, warnings_count, size_bytes, manifest, started_at, completed_at, created_at, store_id, stores(shop_domain, name, plan)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!backup) throw new Error("Backup not found");

    const { data: resources } = await context.supabase
      .from("backup_resources")
      .select("resource_type, status, count, bytes, recoverability, error, created_at")
      .eq("backup_id", data.id)
      .order("created_at", { ascending: true });

    return { backup, resources: resources ?? [] };
  });

export const listRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("activity_log")
      .select("id, kind, title, detail, created_at, store_id")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const dashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [stores, backups, activity] = await Promise.all([
      context.supabase.from("stores").select("id, shop_domain, name, plan, status, last_synced_at"),
      context.supabase
        .from("backups")
        .select(
          "id, status, size_bytes, recovery_score, created_at, completed_at, store_id, label, stores(shop_domain, name)",
        )
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("activity_log")
        .select("id, kind, title, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const backupsData = backups.data ?? [];
    const totalStorage = backupsData.reduce((n, b) => n + (b.size_bytes ?? 0), 0);
    const lastCompleted = backupsData.find((b) => b.status === "completed");

    return {
      stores: stores.data ?? [],
      backups: backupsData,
      activity: activity.data ?? [],
      totalStorage,
      lastCompleted,
    };
  });

export const generateRestorePlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) =>
    z
      .object({
        backup_id: z.string().uuid(),
        target_store_id: z.string().uuid(),
        selected_resources: z.array(z.string()).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateRestorePlan } = await import("@/lib/restore.server");

    const { data: store, error: storeErr } = await context.supabase
      .from("stores")
      .select("id, user_id, shop_domain, access_token_ciphertext")
      .eq("id", data.target_store_id)
      .maybeSingle();
    if (storeErr || !store) throw new Error("Target store not found");

    return await generateRestorePlan(supabaseAdmin, data.backup_id, store, data.selected_resources);
  });

export const startRestoreFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) =>
    z
      .object({ backup_id: z.string().uuid(), target_store_id: z.string().uuid(), plan: z.any() })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: job, error } = await supabaseAdmin
      .from("restore_jobs")
      .insert({
        user_id: context.userId,
        backup_id: data.backup_id,
        target_store_id: data.target_store_id,
        status: "running",
        progress: 0,
        plan: data.plan,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { job_id: job.id };
  });

export const stepRestoreFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v) => z.object({ job_id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { executeRestoreStep } = await import("@/lib/restore.server");

    return await executeRestoreStep(supabaseAdmin, data.job_id);
  });
