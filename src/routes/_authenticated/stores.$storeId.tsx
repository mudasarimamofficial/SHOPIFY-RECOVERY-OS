import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getStore,
  startBackup,
  stepBackupFn,
  deleteStore,
  listBackups,
} from "@/lib/shopify.functions";
import { PageHeader } from "@/components/app-shell";
import { StatusDot } from "./dashboard";
import { formatBytes, formatDate, formatRelative } from "@/lib/format";
import { Zap, Trash2, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { RESOURCE_CATALOG } from "@/lib/resource-catalog";

export const Route = createFileRoute("/_authenticated/stores/$storeId")({
  component: StoreDetail,
});

function StoreDetail() {
  const { storeId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getStore);
  const backupsFn = useServerFn(listBackups);
  const startFn = useServerFn(startBackup);
  const stepFn = useServerFn(stepBackupFn);
  const delFn = useServerFn(deleteStore);

  const { data: store } = useSuspenseQuery(
    queryOptions({
      queryKey: ["store", storeId],
      queryFn: () => getFn({ data: { id: storeId } }),
    }),
  );
  const { data: backupsAll } = useSuspenseQuery(
    queryOptions({ queryKey: ["backups"], queryFn: () => backupsFn() }),
  );
  const backups = backupsAll.filter((b) => b.store_id === storeId);

  const startMut = useMutation({
    mutationFn: async () => {
      const { backup_id } = await startFn({ data: { store_id: storeId } });
      // Drive the backup state machine to completion. Each step advances one
      // stage (REST) or polls one bulk operation; we only pause between bulk
      // polls so completed stages advance immediately.
      let done = false;
      let guard = 0;
      while (!done && guard++ < 400) {
        const res = (await stepFn({ data: { backup_id } })) as {
          done?: boolean;
          status?: string;
        };
        done = Boolean(res?.done);
        if (!done && res?.status === "polling") {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (!done) throw new Error("Backup did not finish within the expected number of steps");
      return { backup_id };
    },
    onSuccess: (r) => {
      toast.success("Backup complete");
      qc.invalidateQueries();
      nav({ to: "/backups/$backupId", params: { backupId: r.backup_id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Backup failed"),
  });

  const delMut = useMutation({
    mutationFn: () => delFn({ data: { id: storeId } }),
    onSuccess: () => {
      toast.success("Store disconnected");
      qc.invalidateQueries();
      nav({ to: "/stores" });
    },
  });

  if (!store) {
    return <div className="p-8 text-sm text-muted-foreground">Store not found.</div>;
  }

  const groups = new Map<string, typeof RESOURCE_CATALOG>();
  for (const r of RESOURCE_CATALOG) {
    if (!groups.has(r.group)) groups.set(r.group, []);
    groups.get(r.group)!.push(r);
  }

  return (
    <div>
      <PageHeader
        eyebrow={store.shop_domain}
        title={store.name ?? store.shop_domain}
        description={`Plan: ${store.plan ?? "—"} · ${store.country ?? ""} · ${store.currency ?? ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/stores"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-elevated"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All stores
            </Link>
            <button
              onClick={() => startMut.mutate()}
              disabled={startMut.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {startMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {startMut.isPending ? "Backing up…" : "Create backup"}
            </button>
          </div>
        }
      />

      <div className="grid gap-6 p-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="surface-panel p-6">
            <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Recoverable resources
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything Imam Migration OS knows how to protect for this store. Items marked{" "}
              <span className="text-success">full</span> are automatically restored;
              <span className="text-warning"> partial</span> respects Shopify limits;{" "}
              <span className="text-info">manual</span> requires reconnecting outside Shopify.
            </p>
            <div className="mt-5 space-y-5">
              {[...groups.entries()].map(([group, list]) => (
                <div key={group}>
                  <div className="mono mb-2 text-[10px] uppercase tracking-widest text-primary">
                    {group}
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {list.map((r) => (
                      <div
                        key={r.key}
                        className="flex items-center justify-between rounded-md border border-border/60 bg-elevated/40 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate">{r.label}</div>
                          {r.scanned && (
                            <div className="mono mt-0.5 text-[9px] uppercase tracking-widest text-success">
                              Scanned in v1
                            </div>
                          )}
                        </div>
                        <RecoveryBadge tier={r.recoverability as any} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-panel">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Backup history
              </div>
              <Link to="/backups" className="text-xs text-primary hover:underline">
                All backups
              </Link>
            </div>
            {backups.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No backups yet for this store. Click{" "}
                <span className="text-foreground">Create backup</span> above.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {backups.map((b) => (
                  <li key={b.id}>
                    <Link
                      to="/backups/$backupId"
                      params={{ backupId: b.id }}
                      className="flex items-center justify-between px-5 py-3 hover:bg-elevated"
                    >
                      <div className="flex items-center gap-3">
                        <StatusDot status={b.status} />
                        <div>
                          <div className="text-sm">{b.label ?? "Snapshot"}</div>
                          <div className="mono text-[11px] text-muted-foreground">
                            {formatRelative(b.created_at)} · {formatBytes(b.size_bytes)}
                          </div>
                        </div>
                      </div>
                      <div className="mono text-sm text-gradient-accent">
                        {b.recovery_score ?? "—"}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-panel p-6">
            <div className="mono flex items-center gap-2 text-[11px] uppercase tracking-widest text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Connection
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Domain" value={<span className="mono">{store.shop_domain}</span>} />
              <Row label="API version" value={<span className="mono">{store.api_version}</span>} />
              <Row label="Plan" value={store.plan ?? "—"} />
              <Row label="Email" value={store.email ?? "—"} />
              <Row label="Connected" value={formatDate(store.created_at)} />
              <Row label="Last synced" value={formatRelative(store.last_synced_at)} />
            </dl>
          </div>

          <button
            onClick={() => {
              if (confirm("Disconnect this store? Backups are preserved.")) delMut.mutate();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive transition hover:bg-destructive/20"
          >
            <Trash2 className="h-4 w-4" /> Disconnect store
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground/90">{value}</dd>
    </div>
  );
}

function RecoveryBadge({ tier }: { tier: "full" | "partial" | "manual" | "unavail" }) {
  const style = {
    full: "text-success border-success/40 bg-success/10",
    partial: "text-warning border-warning/40 bg-warning/10",
    manual: "text-info border-info/40 bg-info/10",
    unavail: "text-muted-foreground border-border bg-elevated",
  }[tier];
  const label = { full: "full", partial: "partial", manual: "manual", unavail: "n/a" }[tier];
  return (
    <span
      className={`mono rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${style}`}
    >
      {label}
    </span>
  );
}
