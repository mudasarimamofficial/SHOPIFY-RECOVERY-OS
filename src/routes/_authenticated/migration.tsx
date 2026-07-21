import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { GitBranch, Loader2, Play, Undo2, ShieldAlert } from "lucide-react";
import {
  listBackups,
  listStores,
  generateRestorePlanFn,
  startRestoreFn,
  stepRestoreFn,
} from "@/lib/shopify.functions";
import { Button } from "@/components/ui/button";

const backupsQuery = (fn: any) => queryOptions({ queryKey: ["backups"], queryFn: () => fn() });
const storesQuery = (fn: any) => queryOptions({ queryKey: ["stores"], queryFn: () => fn() });

export const Route = createFileRoute("/_authenticated/migration")({
  component: RestorePage,
});

function RestorePage() {
  const getBackups = useServerFn(listBackups);
  const getStores = useServerFn(listStores);
  const generatePlan = useServerFn(generateRestorePlanFn);
  const startJob = useServerFn(startRestoreFn);
  const stepJob = useServerFn(stepRestoreFn);

  const { data: backups } = useSuspenseQuery(backupsQuery(getBackups));
  const { data: stores } = useSuspenseQuery(storesQuery(getStores));

  const [selectedBackup, setSelectedBackup] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [currentResource, setCurrentResource] = useState<string>("");
  const [report, setReport] = useState<any>(null);
  const [migrationMode, setMigrationMode] = useState<string>("merge");

  const [selectedResources, setSelectedResources] = useState<string[]>([
    "shop",
    "locations",
    "files",
    "metaobjects",
    "metafields",
    "products_bulk",
    "collections",
    "pages",
    "blogs",
    "articles",
    "redirects",
    "customers_bulk",
    "orders_bulk",
    "theme",
  ]);

  const toggleResource = (res: string) => {
    setSelectedResources((prev) =>
      prev.includes(res) ? prev.filter((r) => r !== res) : [...prev, res],
    );
  };

  const completedBackups = backups.filter((b: any) => b.status === "completed");

  async function handleAnalyze() {
    if (!selectedBackup || !selectedStore) return;
    setIsGenerating(true);
    try {
      const result = await generatePlan({
        data: {
          backup_id: selectedBackup,
          target_store_id: selectedStore,
          selected_resources: selectedResources,
          mode: migrationMode,
        },
      });
      setPlan(result);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleExecute() {
    if (!plan) return;
    setRestoreStatus("running");
    setRestoreProgress(0);
    try {
      const { job_id } = await startJob({
        data: {
          backup_id: plan.backup_id,
          target_store_id: plan.target_store_id,
          plan: plan,
          mode: migrationMode,
        },
      });
      setJobId(job_id);

      let done = false;
      while (!done) {
        const result = await stepJob({ data: { job_id } });
        if (result.done) {
          done = true;
          setRestoreStatus("completed");
          setRestoreProgress(100);
          if (result.report) setReport(result.report);
        } else {
          setRestoreProgress(result.progress ?? 0);
          setCurrentResource(result.current_resource ?? "");
          if (result.report) setReport(result.report);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } catch (e: any) {
      setRestoreStatus("error");
      alert(e.message);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Recovery"
        title="Restore into a Shopify store"
        description="Select a recovery package and a target Shopify store to replay resources into."
      />
      <div className="grid gap-6 p-8 lg:grid-cols-2">
        <div className="surface-panel p-8">
          <div className="mono flex items-center gap-2 text-[11px] uppercase tracking-widest text-primary">
            <GitBranch className="h-3.5 w-3.5" /> Restore Setup
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Source Package</label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedBackup}
                onChange={(e) => setSelectedBackup(e.target.value)}
                disabled={isGenerating || !!jobId}
              >
                <option value="">Select a recovery package...</option>
                {completedBackups.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({(b.stores as any)?.shop_domain})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Target Store</label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                disabled={isGenerating || !!jobId}
              >
                <option value="">Select target store...</option>
                {stores.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.shop_domain})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Migration Mode</label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={migrationMode}
                onChange={(e) => setMigrationMode(e.target.value)}
                disabled={isGenerating || !!jobId}
              >
                <option value="merge">Merge (Update existing, add new)</option>
                <option value="replace">Replace (Overwrite existing)</option>
                <option value="clean">Clean Migration (Delete Target Store data first)</option>
                <option value="dry_run">Dry Run (Analyze only, no mutation)</option>
                <option value="compare_only">Compare Only (Generate deep compare report)</option>
              </select>
            </div>

            <div className="pt-4 pb-2 border-t mt-4">
              <label className="text-sm font-medium mb-2 block">Select Resources to Restore</label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  "shop",
                  "locations",
                  "files",
                  "metaobjects",
                  "metafields",
                  "products_bulk",
                  "collections",
                  "pages",
                  "blogs",
                  "articles",
                  "redirects",
                  "customers_bulk",
                  "orders_bulk",
                  "gift_cards",
                  "discounts",
                  "shipping",
                  "markets",
                  "theme",
                  "navigation",
                ].map((res) => (
                  <label key={res} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedResources.includes(res)}
                      onChange={() => toggleResource(res)}
                      disabled={isGenerating || !!jobId}
                    />
                    <span className="truncate">{res.replace("_bulk", "")}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * Parent dependencies (e.g. locations for products) are automatically included.
              </p>
            </div>

            {!plan && !jobId && (
              <Button
                onClick={handleAnalyze}
                disabled={!selectedBackup || !selectedStore || isGenerating}
                className="w-full"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Analyze Compatibility
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {plan && !jobId && (
            <div className="surface-panel p-8">
              <div className="mono flex items-center gap-2 text-[11px] uppercase tracking-widest text-primary">
                <Undo2 className="h-3.5 w-3.5" /> Execution Plan
              </div>
              <p className="mt-2 text-sm text-muted-foreground mb-4">
                The target API version{" "}
                {plan.compatibility.api_versions_match ? "matches" : "does not match"} the source
                API.
              </p>
              <div className="divide-y divide-border border rounded-md">
                {plan.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between p-3 text-sm">
                    <span className="font-medium">
                      {item.resource_type}{" "}
                      <span className="text-muted-foreground font-normal">x{item.count}</span>
                    </span>
                    <span className={item.action === "create" ? "text-success" : "text-info"}>
                      {item.action}
                    </span>
                  </div>
                ))}
              </div>
              <Button onClick={handleExecute} className="w-full mt-4" variant="default">
                <Play className="mr-2 h-4 w-4" />
                Execute Restore
              </Button>
            </div>
          )}

          {jobId && (
            <div className="surface-panel p-8">
              <h3 className="text-lg font-semibold tracking-tight text-center mb-6">
                {restoreStatus === "completed"
                  ? "Enterprise Restore Complete"
                  : "Enterprise Restore Active"}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-background rounded-md border p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">
                    Progress
                  </div>
                  <div className="text-2xl font-mono mt-1">{restoreProgress}%</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {currentResource || "Initializing..."}
                  </div>
                </div>
                <div className="bg-background rounded-md border p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">
                    Success Rate
                  </div>
                  <div className="text-2xl font-mono mt-1 text-success">
                    {report?.objectsRestored || 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Objects Restored</div>
                </div>
                <div className="bg-background rounded-md border p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">
                    API Cost
                  </div>
                  <div className="text-2xl font-mono mt-1">{report?.liveGraphqlCost || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">GraphQL Points</div>
                </div>
                <div className="bg-background rounded-md border p-4 text-center">
                  <div className="text-xs text-danger uppercase tracking-widest">Failures</div>
                  <div className="text-2xl font-mono mt-1 text-danger">
                    {report?.objectsFailed || 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Objects Failed</div>
                </div>
              </div>

              <div className="mt-4 h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${restoreProgress}%` }}
                />
              </div>

              {report?.failedItems?.length > 0 && (
                <div className="mt-6 border rounded-md">
                  <div className="bg-muted px-4 py-2 text-sm font-medium border-b flex justify-between">
                    <span>Failure Log</span>
                    <span className="text-danger">{report.failedItems.length} issues</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-4 space-y-3 bg-background">
                    {report.failedItems.slice(-20).map((f: any, i: number) => (
                      <div key={i} className="text-xs font-mono break-words">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-danger/10 text-danger font-bold mr-2">
                          {f.classification || "ERR"}
                        </span>
                        <span className="text-muted-foreground">
                          [{f.id}]: {f.error}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="surface-panel p-6">
            <div className="mono flex items-center gap-2 text-[11px] uppercase tracking-widest text-warning">
              <ShieldAlert className="h-3.5 w-3.5" /> Safety rails
            </div>
            <ul className="mt-3 space-y-2 text-sm text-foreground/85">
              <li>· Rollback supported resources on partial failure</li>
              <li>· Idempotent writes — safe to retry</li>
              <li>· Requires explicit confirmation for destructive updates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
