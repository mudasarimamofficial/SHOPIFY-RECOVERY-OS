import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

import { handleShopifyWebhooks } from "./lib/shopify-webhooks.server";
import { handleOAuthCallback } from "./lib/shopify-oauth.server";

type RuntimeEnv = Record<string, string | undefined> | undefined;

export default {
  async fetch(request: Request, env: RuntimeEnv, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Intercept Shopify Webhooks
      if (url.pathname.startsWith("/api/webhooks")) {
        return await handleShopifyWebhooks(request);
      }

      if (url.pathname === "/api/validation") {
        const { handleValidationApi } = await import("./lib/validation-api.server");
        return await handleValidationApi(request);
      }

      if (url.pathname === "/api/verify-store-b") {
        const { handleVerifyStoreBApi } = await import("./lib/verify-store-b-api.server");
        return await handleVerifyStoreBApi(request);
      }

      if (url.pathname.startsWith("/api/download/")) {
        const { handleDownload } = await import("./lib/download.server");
        return await handleDownload(request);
      }

      // Shopify OAuth callback (offline token exchange + install).
      if (url.pathname === "/api/auth/callback") {
        return await handleOAuthCallback(request);
      }

      if (url.pathname === "/api/magic-link") {
        // Dev/QA authentication helper - only active when MAGIC_LINK_SECRET is set.
        // DO NOT deploy to production without setting this to a strong random value.
        const magicLinkSecret = process.env.MAGIC_LINK_SECRET;
        if (!magicLinkSecret || url.searchParams.get("secret") !== magicLinkSecret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("./integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: "mudasarimamofficial@gmail.com",
        });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ link: data.properties.action_link }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/db-debug") {
        const magicLinkSecret = process.env.MAGIC_LINK_SECRET;
        if (!magicLinkSecret || url.searchParams.get("secret") !== magicLinkSecret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("./integrations/supabase/client.server");
        const { data: stores } = await supabaseAdmin
          .from("stores")
          .select("id, shop_domain, name, status");
        const { data: backups } = await supabaseAdmin
          .from("backups")
          .select("id, label, status, progress, current_stage, errors_count, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        const { data: restoreJobs } = await supabaseAdmin
          .from("restore_jobs")
          .select("id, backup_id, target_store_id, status, progress, report, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        const { data: activity } = await supabaseAdmin
          .from("activity_log")
          .select("id, kind, title, detail, created_at")
          .order("created_at", { ascending: false })
          .limit(10);

        return new Response(JSON.stringify({ stores, backups, restoreJobs, activity }, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/store-counts") {
        const magicLinkSecret = process.env.MAGIC_LINK_SECRET;
        if (!magicLinkSecret || url.searchParams.get("secret") !== magicLinkSecret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("./integrations/supabase/client.server");
        const { AuthManager } = await import("./lib/auth-manager.server");

        const { data: stores } = await supabaseAdmin.from("stores").select("*");
        const counts: Record<string, any> = {};

        for (const store of stores || []) {
          if (!store.access_token_ciphertext) continue;
          try {
            const client = await AuthManager.getUnifiedClient(supabaseAdmin, store.id);

            const prodRes = await client.rest<any>("/products/count.json");
            const custRes = await client.rest<any>("/customers/count.json");
            const ordRes = await client.rest<any>("/orders/count.json?status=any");
            const smartRes = await client.rest<any>("/smart_collections/count.json");
            const customRes = await client.rest<any>("/custom_collections/count.json");

            counts[store.shop_domain] = {
              products: prodRes?.count ?? 0,
              customers: custRes?.count ?? 0,
              orders: ordRes?.count ?? 0,
              collections: (smartRes?.count ?? 0) + (customRes?.count ?? 0),
            };
          } catch (e: any) {
            counts[store.shop_domain] = { error: e.message };
          }
        }

        return new Response(JSON.stringify(counts, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
