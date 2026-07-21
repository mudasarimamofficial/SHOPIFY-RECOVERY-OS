import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { connectShopifyStore, beginShopifyOAuth } from "@/lib/shopify.functions";
import { Loader2, Store, ShieldCheck, CheckCircle2, Key, Link as LinkIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/connect")({
  component: ConnectPage,
});

const REQUIRED_SCOPES = [
  "read_products",
  "read_content",
  "read_themes",
  "read_customers",
  "read_orders",
  "read_files",
  "read_locations",
  "read_inventory",
  "read_translations",
  "read_price_rules",
  "read_metaobjects",
  "read_online_store_pages",
  "read_online_store_navigation",
  "write_products",
  "write_content",
  "write_themes",
  "write_customers",
  "write_orders",
  "write_files",
  "write_locations",
  "write_inventory",
  "write_price_rules",
  "write_metaobjects",
];

function ConnectPage() {
  const connectCustomFn = useServerFn(connectShopifyStore);
  const beginOAuthFn = useServerFn(beginShopifyOAuth);
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState<"oauth" | "custom">("oauth");
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");

  const customMutation = useMutation({
    mutationFn: (v: { shop_domain: string; access_token: string }) => connectCustomFn({ data: v }),
    onSuccess: (res) => {
      toast.success(`Successfully connected ${res.store.name || res.store.shop_domain}`);
      navigate({ to: "/stores" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not connect Custom App"),
  });

  const oauthMutation = useMutation({
    mutationFn: (v: { shop_domain: string }) => beginOAuthFn({ data: v }),
    onSuccess: (res) => {
      if (res.authorizeUrl) {
        window.location.href = res.authorizeUrl;
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start Shopify OAuth"),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Connect Store"
        description="Authorize Imam Recovery OS securely using either Shopify OAuth or a Custom App Admin Token."
      />
      <div className="grid gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="surface-panel p-8">
          <div className="flex items-center gap-2 text-primary">
            <Store className="h-4 w-4" />
            <span className="mono text-[11px] uppercase tracking-widest">Connect Method</span>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-4 mb-8">
            <button
              onClick={() => setAuthMode("oauth")}
              className={`flex-1 rounded-md border p-4 text-left transition ${
                authMode === "oauth"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                <span className="font-semibold text-sm">Shopify OAuth</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                (Recommended) Install the Partner App automatically.
              </p>
            </button>
            <button
              onClick={() => setAuthMode("custom")}
              className={`flex-1 rounded-md border p-4 text-left transition ${
                authMode === "custom"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                <span className="font-semibold text-sm">Custom App Token</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                (Advanced) Provide an Admin API Token manually.
              </p>
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!domain) return;
              if (authMode === "oauth") {
                oauthMutation.mutate({ shop_domain: domain });
              } else {
                if (!token) return;
                customMutation.mutate({ shop_domain: domain, access_token: token });
              }
            }}
            className="space-y-5"
          >
            <div>
              <label className="mono block text-[10px] uppercase tracking-widest text-muted-foreground">
                Shop domain
              </label>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="atlas-supply.myshopify.com"
                autoFocus
                className="mono mt-1.5 w-full rounded-md border border-border bg-elevated px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring"
              />
            </div>

            {authMode === "custom" && (
              <div>
                <label className="mono block text-[10px] uppercase tracking-widest text-muted-foreground">
                  Admin API Access Token
                </label>
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  type="password"
                  placeholder="shpat_..."
                  className="mono mt-1.5 w-full rounded-md border border-border bg-elevated px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Must start with <span className="mono">shpat_</span>
                </p>
              </div>
            )}

            <button
              disabled={
                !domain ||
                (authMode === "custom" && !token) ||
                customMutation.isPending ||
                oauthMutation.isPending
              }
              type="submit"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {customMutation.isPending || oauthMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : authMode === "oauth" ? (
                <LinkIcon className="h-4 w-4" />
              ) : (
                <Key className="h-4 w-4" />
              )}
              {authMode === "oauth" ? "Connect with Shopify" : "Connect Custom App"}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="surface-panel p-6">
            <div className="mono flex items-center gap-2 text-[11px] uppercase tracking-widest text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Security
            </div>
            <ul className="mt-3 space-y-2 text-sm text-foreground/85">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Multi-Provider Architecture
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Tokens are AES-256-GCM encrypted
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Never cached in plaintext
              </li>
            </ul>
          </div>

          <div className="surface-panel p-6">
            <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Required Scopes
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {REQUIRED_SCOPES.map((s) => (
                <span
                  key={s}
                  className="mono rounded-md border border-border bg-elevated px-2 py-0.5 text-[10px] text-foreground/80"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
