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

import { handleShopifyAuth, handleShopifyAuthCallback, handleShopifyWebhooks } from "./lib/shopify-oauth.server";

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Intercept Shopify OAuth routes
      if (url.pathname === "/api/auth") {
        return await handleShopifyAuth(request);
      }
      if (url.pathname === "/api/auth/callback") {
        return await handleShopifyAuthCallback(request);
      }
      if (url.pathname.startsWith("/api/webhooks")) {
        return await handleShopifyWebhooks(request);
      }

        if (url.pathname === "/api/verify-installation") {
          try {
            const { createClient } = await import("@supabase/supabase-js");
            const SUPABASE_URL = env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
            const SUPABASE_SERVICE_ROLE_KEY = env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
            const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false }});
            const { decryptToken } = await import("@/lib/shopify.server");
            const { data: stores, error: storeErr } = await supabase.from("stores").select("*").not("shop_domain", "eq", "test-pipeline-store.myshopify.com").limit(1);
            if (storeErr || !stores || stores.length === 0) return new Response("No stores found", { status: 404 });
            const store = stores[0];
            const decryptedToken = decryptToken(store.access_token_ciphertext);
            const gqlUrl = `https://${store.shop_domain}/admin/api/2024-01/graphql.json`;
            const res = await fetch(gqlUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": decryptedToken },
              body: JSON.stringify({ query: "{ shop { name id } }" })
            });
            const json = await res.json();
            return new Response(JSON.stringify({
              status: "PASS",
              store: store.shop_domain,
              graphqlResult: json
            }), { status: 200 });
          } catch (e: any) {
            return new Response(JSON.stringify({ status: "FAIL", error: e.message }), { status: 500 });
          }
        }

        if (url.pathname === "/api/test-pipeline") {
        try {
          const SUPABASE_URL = env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
          const SUPABASE_SERVICE_ROLE_KEY = env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return new Response("Missing Supabase credentials", { status: 500 });
          }
          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }});
          
          const { data: user, error: userErr } = await supabase.auth.admin.createUser({
            email: "test_pipeline@example.com",
            password: "test_password123",
            email_confirm: true
          });
          const userId = user?.user?.id || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === "test_pipeline@example.com")?.id;
          if (!userId) return new Response("No user ID", { status: 500 });

          const { encryptToken } = await import("@/lib/shopify.server");
          const fakeEncryptedToken = encryptToken("shpua_test123");

          const { data: store, error: storeErr } = await supabase.from("stores").upsert({
            user_id: userId, shop_domain: "test-pipeline-store.myshopify.com", access_token_ciphertext: fakeEncryptedToken, status: "connected"
          }, { onConflict: "user_id, shop_domain" }).select().single();
          if (storeErr || !store) return new Response("Store err: " + JSON.stringify(storeErr), { status: 500 });

          const { data: backup, error: backupErr } = await supabase.from("backups").insert({
            user_id: userId, store_id: store.id, status: "pending"
          }).select().single();
          if (backupErr || !backup) return new Response("Backup err: " + JSON.stringify(backupErr), { status: 500 });

          const { stepBackup } = await import("@/lib/backup.server");
          
          try {
            const result = await stepBackup(supabase, store, backup.id);
            return new Response(JSON.stringify({ status: "FAIL", msg: "Should have thrown auth error", result }), { status: 200 });
          } catch (e: any) {
            return new Response(JSON.stringify({ status: "PASS", msg: "Caught expected error", error: e.message }));
          }
        } catch (globalErr: any) {
          return new Response(JSON.stringify({ status: "FAIL", error: globalErr.message }), { status: 500 });
        }
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
