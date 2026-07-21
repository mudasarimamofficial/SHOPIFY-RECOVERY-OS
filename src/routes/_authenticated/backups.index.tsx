import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBackups } from "@/lib/shopify.functions";
import { PageHeader } from "@/components/app-shell";
import { StatusDot } from "./dashboard";
import { formatBytes, formatRelative } from "@/lib/format";
import { Archive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/backups/")({
  component: BackupsPage,
});

function BackupsPage() {
  const fn = useServerFn(listBackups);
  const { data } = useSuspenseQuery(queryOptions({ queryKey: ["backups"], queryFn: () => fn() }));

  return (
    <div>
      <PageHeader
        eyebrow="Snapshots"
        title="Backups"
        description="Every recovery package generated across all stores."
      />
      <div className="p-8">
        {data.length === 0 ? (
          <div className="surface-panel p-12 text-center">
            <Archive className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              No backups yet. Open a store and click{" "}
              <span className="text-foreground">Create backup</span>.
            </p>
          </div>
        ) : (
          <div className="surface-panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="mono border-b border-border bg-surface/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-normal">Label</th>
                  <th className="px-5 py-3 text-left font-normal">Store</th>
                  <th className="px-5 py-3 text-left font-normal">Status</th>
                  <th className="px-5 py-3 text-right font-normal">Score</th>
                  <th className="px-5 py-3 text-right font-normal">Size</th>
                  <th className="px-5 py-3 text-right font-normal">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-border last:border-b-0 hover:bg-elevated/60"
                  >
                    <td className="px-5 py-3">
                      <Link
                        to="/backups/$backupId"
                        params={{ backupId: b.id }}
                        className="font-medium hover:text-primary"
                      >
                        {b.label ?? "Snapshot"}
                      </Link>
                    </td>
                    <td className="mono px-5 py-3 text-xs text-muted-foreground">
                      {(b.stores as { shop_domain?: string } | null)?.shop_domain ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2 text-xs capitalize">
                        <StatusDot status={b.status} /> {b.status}
                      </span>
                    </td>
                    <td className="mono px-5 py-3 text-right text-gradient-accent">
                      {b.recovery_score ?? "—"}
                    </td>
                    <td className="mono px-5 py-3 text-right text-xs">
                      {formatBytes(b.size_bytes)}
                    </td>
                    <td className="mono px-5 py-3 text-right text-xs text-muted-foreground">
                      {formatRelative(b.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
