import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dashboardSummary } from "@/lib/shopify.functions";
import { PageHeader } from "@/components/app-shell";
import {
  Archive,
  Plug,
  Store as StoreIcon,
  ShieldCheck,
  Clock,
  HardDrive,
  Activity,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import { formatBytes, formatRelative } from "@/lib/format";

const summaryOptions = (fn: () => Promise<Awaited<ReturnType<typeof dashboardSummary>>>) =>
  queryOptions({
    queryKey: ["dashboard-summary"],
    queryFn: () => fn(),
  });

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const fn = useServerFn(dashboardSummary);
  const { data } = useSuspenseQuery(summaryOptions(fn));

  const storeCount = data.stores.length;
  const backupCount = data.backups.length;
  const lastScore = data.lastCompleted?.recovery_score ?? null;
  const lastAt = data.lastCompleted?.completed_at ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Console"
        title="Dashboard"
        description="Operational overview of every connected Shopify store and its recovery posture."
        actions={
          <Link
            to="/backups"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-elevated"
          >
            <Archive className="h-4 w-4" /> All backups
          </Link>
        }
      />

      <div className="p-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            icon={<StoreIcon className="h-4 w-4" />}
            label="Connected stores"
            value={String(storeCount)}
            hint={storeCount === 0 ? "Connect your first" : ""}
          />
          <Kpi
            icon={<Archive className="h-4 w-4" />}
            label="Backups"
            value={String(backupCount)}
            hint={backupCount === 0 ? "None yet" : ""}
          />
          <Kpi
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Recovery score"
            value={lastScore !== null ? String(lastScore) : "—"}
            suffix={lastScore !== null ? "/100" : undefined}
            accent
          />
          <Kpi
            icon={<HardDrive className="h-4 w-4" />}
            label="Total storage"
            value={formatBytes(data.totalStorage)}
            hint={lastAt ? `Last ${formatRelative(lastAt)}` : ""}
          />
        </div>

        {/* Empty state */}
        {storeCount === 0 && (
          <div className="surface-panel mt-8 flex flex-col items-center gap-4 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-elevated text-primary">
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <div className="mono text-[11px] uppercase tracking-widest text-primary">
                Getting started
              </div>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">
                Connect your first Shopify store
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Imam Recovery OS needs an Admin API access token from a custom app on your Shopify
                store. Takes about 60 seconds.
              </p>
            </div>
            <Link
              to="/connect"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Connect Shopify <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Stores */}
          <div className="lg:col-span-2">
            <SectionHeader
              title="Stores"
              action={
                <Link to="/connect" className="text-xs text-primary hover:underline">
                  + Add store
                </Link>
              }
            />
            <div className="surface-panel divide-y divide-border">
              {data.stores.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No stores connected.</div>
              ) : (
                data.stores.map((s) => (
                  <Link
                    key={s.id}
                    to="/stores/$storeId"
                    params={{ storeId: s.id }}
                    className="flex items-center justify-between px-5 py-4 transition hover:bg-elevated"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-elevated">
                        <StoreIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{s.name ?? s.shop_domain}</div>
                        <div className="mono text-[11px] text-muted-foreground">
                          {s.shop_domain}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          Plan
                        </div>
                        <div className="text-xs">{s.plan ?? "—"}</div>
                      </div>
                      <div>
                        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          Status
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-success">
                          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-success" />
                          {s.status}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <SectionHeader title="Recent backups" className="mt-8" />
            <div className="surface-panel divide-y divide-border">
              {data.backups.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No backups yet. Create your first snapshot from a store page.
                </div>
              ) : (
                data.backups.slice(0, 6).map((b) => (
                  <Link
                    key={b.id}
                    to="/backups/$backupId"
                    params={{ backupId: b.id }}
                    className="flex items-center justify-between px-5 py-3 transition hover:bg-elevated"
                  >
                    <div className="flex items-center gap-3">
                      <StatusDot status={b.status} />
                      <div>
                        <div className="text-sm">{b.label ?? "Snapshot"}</div>
                        <div className="mono text-[11px] text-muted-foreground">
                          {(b.stores as { shop_domain?: string } | null)?.shop_domain ?? "—"} ·{" "}
                          {formatRelative(b.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          Score
                        </div>
                        <div className="mono text-sm text-gradient-accent">
                          {b.recovery_score ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          Size
                        </div>
                        <div className="mono text-xs">{formatBytes(b.size_bytes)}</div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Activity + quick actions */}
          <div className="space-y-6">
            <div>
              <SectionHeader title="Quick actions" />
              <div className="surface-panel divide-y divide-border">
                <QuickAction
                  to="/connect"
                  icon={<Plug />}
                  title="Connect Shopify"
                  desc="Add a store"
                />
                <QuickAction
                  to="/stores"
                  icon={<Zap />}
                  title="Create backup"
                  desc="Run a fresh snapshot"
                />
                <QuickAction
                  to="/restore"
                  icon={<Archive />}
                  title="Restore package"
                  desc="Deploy to another store"
                />
              </div>
            </div>

            <div>
              <SectionHeader title="Recent activity" />
              <div className="surface-panel">
                {data.activity.length === 0 ? (
                  <div className="p-5 text-sm text-muted-foreground">Nothing here yet.</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.activity.map((a) => (
                      <li key={a.id} className="px-5 py-3">
                        <div className="flex items-start gap-2">
                          <Activity className="mt-0.5 h-3.5 w-3.5 text-primary" />
                          <div className="min-w-0">
                            <div className="truncate text-sm">{a.title}</div>
                            {a.detail && (
                              <div className="mono truncate text-[11px] text-muted-foreground">
                                {a.detail}
                              </div>
                            )}
                            <div className="mono mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                              <Clock className="mr-1 inline h-2.5 w-2.5" />
                              {formatRelative(a.created_at)}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  suffix,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="surface-panel p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="mono text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span
          className={`mono text-3xl font-semibold ${accent ? "text-gradient-accent" : "text-foreground"}`}
        >
          {value}
        </span>
        {suffix && <span className="mono text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <div className="mono mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function SectionHeader({
  title,
  action,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className}`}>
      <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      {action}
    </div>
  );
}

function QuickAction({
  to,
  icon,
  title,
  desc,
}: {
  to: "/connect" | "/stores" | "/restore";
  icon: React.ReactElement;
  title: string;
  desc: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 px-5 py-3 transition hover:bg-elevated">
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-elevated text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}

export function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-success",
    running: "bg-info pulse-dot",
    pending: "bg-warning pulse-dot",
    failed: "bg-destructive",
  };
  return <span className={`h-2 w-2 rounded-full ${map[status] ?? "bg-muted-foreground"}`} />;
}
