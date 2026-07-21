import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/app-shell";
import { FileText, Download, Copy, RefreshCw, FileCode } from "lucide-react";
import { supabase } from "../../integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["reports"],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("reports")
            .select("*")
            .order("created_at", { ascending: false });
          if (error) throw error;
          return data;
        },
      }),
    ),
});

function ReportsPage() {
  const { data: reports } = useSuspenseQuery(
    queryOptions({
      queryKey: ["reports"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      },
    }),
  );

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const downloadReport = (report: any) => {
    const blob = new Blob([report.content], {
      type: report.format === "json" ? "application/json" : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.type.replace(/\s+/g, "_").toLowerCase()}_${report.restore_id}.${report.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Enterprise Recovery Reports"
        description="Zero Trust evidence of runtime restoration, conflicts, and merchant intelligence."
        eyebrow="INTELLIGENCE"
      />
      <div className="p-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reports?.length === 0 ? (
          <div className="col-span-full text-center p-12 text-muted-foreground border rounded-lg bg-surface">
            No reports generated yet. Execute a restore to generate recovery intelligence.
          </div>
        ) : (
          reports?.map((report) => (
            <Card key={report.id} className="flex flex-col">
              <CardHeader className="pb-4 border-b">
                <div className="flex items-center gap-2">
                  {report.format === "json" ? (
                    <FileCode className="h-5 w-5 text-blue-500" />
                  ) : (
                    <FileText className="h-5 w-5 text-green-500" />
                  )}
                  <CardTitle className="text-base">{report.type}</CardTitle>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Store A: {report.store_a} &rarr; Store B: {report.store_b}
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col justify-between gap-4">
                <div className="text-sm text-muted-foreground line-clamp-3">
                  {report.content.slice(0, 150)}...
                </div>
                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => downloadReport(report)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                  <button
                    onClick={() => copyToClipboard(report.content)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
