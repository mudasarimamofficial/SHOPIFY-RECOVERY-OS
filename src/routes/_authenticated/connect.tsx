import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { beginShopifyOAuth } from "@/lib/shopify.functions";
import { Loader2, Store, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";

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
];

function ConnectPage() {
  const beginOAuth = useServerFn(beginShopifyOAuth);
  const [domain, setDomain] = useState("");

  // Surface OAuth callback errors (redirected back with ?error=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      toast.error(`Shopify connection failed: ${decodeURIComponent(err)}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const m = useMutation({
    mutationFn: (v: { shop_domain: string }) => beginOAuth({ data: v }),
    onSuccess: (res) => {
      // Hand off to Shopify's authorization screen.
      window.location.href = res.authorizeUrl;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start Shopify OAuth"),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Connect Shopify"
        description="Authorize Imam Recovery OS on your Shopify store. You'll be redirected to Shopify to approve access — no tokens to copy or paste."
      />
      <div className="grid gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!domain) return;
            m.mutate({ shop_domain: domain });
          }}
          className="surface-panel p-8"
        >
          <div className="flex items-center gap-2 text-primary">
            <Store className="h-4 w-4" />
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
                autoFocus
                className="mono mt-1.5 w-full rounded-md border border-border bg-elevated px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Enter your <span className="mono">.myshopify.com</span> domain. We'll redirect you
                to Shopify to approve the install.
              </p>
            </div>

            <button
              disabled={!domain || m.isPending}
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {m.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Connect with Shopify
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
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Official Shopify OAuth
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Offline token, AES-256-GCM
                at rest
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> No tokens ever entered by
                hand
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> Revocable from Shopify
                Admin
              </li>
            </ul>
          </div>

          <div className="surface-panel p-6">
            <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">
              How it works
            </div>
            <ol className="mt-3 space-y-2 text-sm text-foreground/85">
              <li>
                <span className="mono text-primary">01</span> Enter your shop domain
              </li>
              <li>
                <span className="mono text-primary">02</span> Approve access on Shopify's screen
              </li>
              <li>
                <span className="mono text-primary">03</span> Shopify redirects back and we finish
                the install
              </li>
              <li>
                <span className="mono text-primary">04</span> Your store is ready to back up
              </li>
            </ol>
          </div>

          <div className="surface-panel p-6">
            <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Requested access
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
