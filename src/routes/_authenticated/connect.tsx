import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { connectShopifyStore } from "@/lib/shopify.functions";
import { Loader2, KeyRound, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";

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
  "read_shipping",
  "read_price_rules",
  "read_metaobjects",
  "read_online_store_pages",
  "read_online_store_navigation",
];

function ConnectPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(connectShopifyStore);
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");

  const m = useMutation({
    mutationFn: (v: { shop_domain: string; access_token: string }) => fn({ data: v }),
    onSuccess: (res) => {
      toast.success(`Connected ${res.store.shop_domain}`);
      qc.invalidateQueries();
      nav({ to: "/stores/$storeId", params: { storeId: res.store.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Connection failed"),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Connect Shopify"
        description="Paste an Admin API access token from a custom app in your Shopify store. Tokens are encrypted with AES-256-GCM before storage."
      />
      <div className="grid gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!domain) return;
            // Initiate OAuth flow by redirecting to /api/auth?shop=...
            const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
            window.location.href = `/api/auth?shop=${encodeURIComponent(cleanDomain)}`;
          }}
          className="surface-panel p-8"
        >
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="h-4 w-4" />
            <span className="mono text-[11px] uppercase tracking-widest">Connect Store</span>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mono block text-[10px] uppercase tracking-widest text-muted-foreground">
                Shop domain
              </label>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="atlas-supply.myshopify.com"
                className="mono mt-1.5 w-full rounded-md border border-border bg-elevated px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Enter your .myshopify.com subdomain to initiate the secure OAuth flow.
              </p>
            </div>

            <button
              disabled={!domain}
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              <ArrowRight className="h-4 w-4" />
              Connect via Shopify
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="surface-panel p-6">
            <div className="mono flex items-center gap-2 text-[11px] uppercase tracking-widest text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Security
            </div>
            <ul className="mt-3 space-y-2 text-sm text-foreground/85">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> AES-256-GCM at rest
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Read-only recommended
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Never exposed in the UI
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Revokable from Shopify
                Admin
              </li>
            </ul>
          </div>

          <div className="surface-panel p-6">
            <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Create a custom app
            </div>
            <ol className="mt-3 space-y-2 text-sm text-foreground/85">
              <li>
                <span className="mono text-primary">01</span> Shopify Admin → Settings → Apps and
                sales channels
              </li>
              <li>
                <span className="mono text-primary">02</span> Develop apps → Create an app
              </li>
              <li>
                <span className="mono text-primary">03</span> Configure Admin API scopes (see below)
              </li>
              <li>
                <span className="mono text-primary">04</span> Install app → reveal the Admin API
                access token
              </li>
              <li>
                <span className="mono text-primary">05</span> Paste it here
              </li>
            </ol>
          </div>

          <div className="surface-panel p-6">
            <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Recommended scopes
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
