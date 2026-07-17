import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBackups } from "@/lib/shopify.functions";
import { PageHeader } from "@/components/app-shell";
import { formatBytes, formatDate } from "@/lib/format";
import { FileBarChart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const fn = useServerFn(listBackups);
  const { data } = useSuspenseQuery(
    queryOptions({ queryKey: ["backups"], queryFn: () => fn() }),
  );

  const completed = data.filter((b) => b.status === "completed");
  const avgScore = completed.length
    ? Math.round(completed.reduce((n, b) => n + (b.recovery_score ?? 0), 0) / completed.length)
    : null;
  const totalSize = data.reduce((n, b) => n + (b.size_bytes ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Recovery reports"
        description="Cross-store recovery posture, package inventory, and completeness over time."
      />
      <div className="p-8 space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Backups completed" value={String(completed.length)} />
          <StatCard label="Average recovery score" value={avgScore !== null ? `${avgScore}/100` : "—"} accent />
          <StatCard label="Total archive size" value={formatBytes(totalSize)} />
        </div>

        <div className="surface-panel">
          <div className="border-b border-border px-5 py-3 mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Snapshot log
          </div>
          {completed.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <FileBarChart className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No completed backups yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="mono border-b border-border bg-surface/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-normal">Store</th>
                  <th className="px-5 py-3 text-left font-normal">Label</th>
                  <th className="px-5 py-3 text-right font-normal">Score</th>
                  <th className="px-5 py-3 text-right font-normal">Size</th>
                  <th className="px-5 py-3 text-right font-normal">Completed</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-b-0">
                    <td className="mono px-5 py-3 text-xs">
                      {(b.stores as { shop_domain?: string } | null)?.shop_domain ?? "—"}
                    </td>
                    <td className="px-5 py-3">{b.label ?? "Snapshot"}</td>
                    <td className="mono px-5 py-3 text-right text-gradient-accent">
                      {b.recovery_score ?? "—"}
                    </td>
                    <td className="mono px-5 py-3 text-right text-xs">{formatBytes(b.size_bytes)}</td>
                    <td className="mono px-5 py-3 text-right text-xs text-muted-foreground">
                      {formatDate(b.completed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="surface-panel p-5">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mono mt-2 text-3xl font-semibold ${accent ? "text-gradient-accent" : ""}`}>
        {value}
      </div>
    </div>
  );
}
