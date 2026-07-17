import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStores } from "@/lib/shopify.functions";
import { PageHeader } from "@/components/app-shell";
import { Store as StoreIcon, Plug } from "lucide-react";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/stores")({
  component: StoresPage,
});

function StoresPage() {
  const fn = useServerFn(listStores);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["stores"], queryFn: () => fn() }),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Assets"
        title="Stores"
        description="Every Shopify store connected to this workspace."
        actions={
          <Link
            to="/connect"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plug className="h-4 w-4" /> Connect store
          </Link>
        }
      />

      <div className="p-8">
        {data.length === 0 ? (
          <div className="surface-panel p-12 text-center text-sm text-muted-foreground">
            No stores yet.{" "}
            <Link to="/connect" className="text-primary hover:underline">
              Connect your first
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((s) => (
              <Link
                key={s.id}
                to="/stores/$storeId"
                params={{ storeId: s.id }}
                className="surface-panel group flex flex-col p-5 transition hover:border-border-strong"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-elevated text-primary">
                    <StoreIcon className="h-4 w-4" />
                  </div>
                  <span className="mono flex items-center gap-1.5 text-[11px] text-success">
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-success" />
                    {s.status}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-base font-semibold tracking-tight">
                    {s.name ?? s.shop_domain}
                  </div>
                  <div className="mono text-[11px] text-muted-foreground">{s.shop_domain}</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                  <Stat label="Plan" value={s.plan ?? "—"} />
                  <Stat label="Currency" value={s.currency ?? "—"} />
                  <Stat label="Country" value={s.country ?? "—"} />
                </div>
                <div className="mono mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Synced {formatRelative(s.last_synced_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate">{value}</div>
    </div>
  );
}
