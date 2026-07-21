import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getBackup } from "@/lib/shopify.functions";
import { PageHeader } from "@/components/app-shell";
import { StatusDot } from "./dashboard";
import { formatBytes, formatDate } from "@/lib/format";
import { Download, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { RESOURCE_CATALOG } from "@/lib/resource-catalog";

export const Route = createFileRoute("/_authenticated/backups/$backupId")({
  component: BackupDetail,
});

function BackupDetail() {
  const { backupId } = Route.useParams();
  const fn = useServerFn(getBackup);
  const { data } = useSuspenseQuery(
    queryOptions({
      queryKey: ["backup", backupId],
      queryFn: () => fn({ data: { id: backupId } }),
      refetchInterval: (q) => {
        const status = (q.state.data as { backup?: { status?: string } } | undefined)?.backup
          ?.status;
        return status === "running" || status === "pending" ? 2000 : false;
      },
    }),
  );

  const dl = useMutation({
    mutationFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Unauthorized: No session token found");
      window.location.assign(`/api/download/${backupId}?token=${token}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Download failed"),
  });

  const { backup, resources } = data;
  const store = backup.stores as { shop_domain?: string; name?: string; plan?: string } | null;
  const catalog = new Map(RESOURCE_CATALOG.map((r) => [r.key, r]));

  return (
    <div>
      <PageHeader
        eyebrow={backup.status.toUpperCase()}
        title={backup.label ?? "Snapshot"}
        description={`${store?.name ?? store?.shop_domain ?? "—"} · ${formatDate(backup.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/backups"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-elevated"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All backups
            </Link>
            <button
              disabled={backup.status !== "completed" || dl.isPending}
              onClick={() => dl.mutate()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {dl.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download .recovery
            </button>
          </div>
        }
      />

      <div className="grid gap-6 p-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {backup.status === "running" || backup.status === "pending" ? (
            <div className="surface-panel p-6">
              <div className="mono text-[11px] uppercase tracking-widest text-primary">
                In progress
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm">{backup.current_stage ?? "starting…"}</div>
                <div className="mono text-sm">{backup.progress}%</div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${backup.progress}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="surface-panel">
            <div className="border-b border-border px-5 py-3 mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Resources
            </div>
            <ul className="divide-y divide-border">
              {resources.map((r) => {
                const spec = catalog.get(r.resource_type);
                return (
                  <li
                    key={r.resource_type}
                    className="flex items-center justify-between px-5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {r.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      ) : r.status === "failed" ? (
                        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate">{spec?.label ?? r.resource_type}</div>
                        {r.error && (
                          <div className="mono truncate text-[11px] text-destructive">
                            {r.error}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mono text-xs text-muted-foreground">
                      {r.count.toLocaleString()} items
                    </div>
                  </li>
                );
              })}
              {resources.length === 0 && (
                <li className="p-5 text-sm text-muted-foreground">No resources yet.</li>
              )}
            </ul>
          </div>

          <div className="surface-panel p-6">
            <div className="mono text-[11px] uppercase tracking-widest text-info">
              Post-Recovery Reports
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your recovery reports, including the full Merchant Recovery Book and conflict logs,
              have been generated.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/reports" className="text-primary hover:underline font-medium text-sm">
                View All Reports &rarr;
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-panel p-6 text-center">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Recovery score
            </div>
            <div className="mono mt-2 text-6xl font-semibold text-gradient-accent">
              {backup.recovery_score ?? "—"}
            </div>
            <div className="mono text-xs text-muted-foreground">out of 100</div>
          </div>

          <div className="surface-panel p-6">
            <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Summary
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Status">
                <span className="inline-flex items-center gap-2 capitalize">
                  <StatusDot status={backup.status} /> {backup.status}
                </span>
              </Row>
              <Row label="Resources">
                {backup.resources_completed}/{backup.resources_total}
              </Row>
              <Row label="Errors">{backup.errors_count}</Row>
              <Row label="Package size">{formatBytes(backup.size_bytes)}</Row>
              <Row label="Store">{store?.shop_domain ?? "—"}</Row>
              <Row label="Completed">{formatDate(backup.completed_at)}</Row>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground/90">{children}</dd>
    </div>
  );
}
