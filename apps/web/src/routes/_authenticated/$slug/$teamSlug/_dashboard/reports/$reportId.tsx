import { Button } from "@packages/ui/components/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ArrowLeft, FileDown } from "lucide-react";
import { QueryBoundary } from "@/components/query-boundary";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
import { REPORT_LABELS } from "../-reports/report-labels";
import { ReportData } from "../-reports/report-panels";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/reports/$reportId",
)({
   loader: ({ context, params }) => {
      context.queryClient.prefetchQuery(
         orpc.reports.get.queryOptions({ input: { id: params.reportId } }),
      );
   },
   pendingMs: 300,
   pendingComponent: ReportDetailSkeleton,
   errorComponent: ReportDetailError,
   head: () => ({
      meta: [{ title: "Relatório — Montte" }],
   }),
   component: ReportDetailPage,
});

function ReportDetailSkeleton() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden px-4 pb-4">
         <div className="bg-muted h-10 w-1/3 rounded-md" />
         <div className="bg-muted h-80 w-full rounded-md" />
      </main>
   );
}

function ReportDetailError() {
   const { slug, teamSlug } = useDashboardSlugs();
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden px-4 pb-4">
         <div className="flex flex-col gap-4">
            <h1 className="text-lg font-semibold">Relatório não encontrado</h1>
            <p className="text-muted-foreground text-sm">
               O relatório pode ter sido removido ou você não tem acesso.
            </p>
            <Button asChild size="sm" variant="outline">
               <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/reports">
                  <ArrowLeft />
                  Voltar para relatórios
               </Link>
            </Button>
         </div>
      </main>
   );
}

function ReportDetailPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <div className="flex min-h-0 flex-1 flex-col gap-4">
            <QueryBoundary
               fallback={<ReportDetailSkeleton />}
               errorTitle="Erro ao carregar relatório"
            >
               <ReportDetailContent />
            </QueryBoundary>
         </div>
      </main>
   );
}

function ReportDetailContent() {
   const { reportId } = Route.useParams();
   const { slug, teamSlug } = useDashboardSlugs();
   const { data: report } = useSuspenseQuery(
      orpc.reports.get.queryOptions({ input: { id: reportId } }),
   );
   const Icon = REPORT_LABELS[report.type].icon;

   return (
      <div className="flex flex-1 min-h-0 flex-col gap-4">
         <div className="flex flex-wrap items-center justify-between gap-2">
            <Button asChild size="sm" variant="ghost">
               <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/reports">
                  <ArrowLeft />
                  Relatórios
               </Link>
            </Button>
            <Button onClick={() => window.print()} size="sm" variant="outline">
               <FileDown />
               Exportar PDF
            </Button>
         </div>

         <div className="bg-card flex flex-col gap-4 rounded-md border p-4">
            <div className="flex flex-wrap items-start gap-4">
               <span className="text-muted-foreground bg-muted/30 flex size-10 items-center justify-center rounded-md border">
                  <Icon className="size-4" />
               </span>
               <div className="flex min-w-0 flex-col gap-2">
                  <h1 className="truncate text-base font-semibold">
                     {report.name}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                     {REPORT_LABELS[report.type].label} ·{" "}
                     {dayjs(report.config.dateFrom).format("DD/MM/YYYY")} —{" "}
                     {dayjs(report.config.dateTo).format("DD/MM/YYYY")}
                  </p>
               </div>
            </div>
         </div>

         <div className="bg-card flex min-h-0 flex-1 flex-col gap-4 overflow-auto rounded-md border p-4">
            <QueryBoundary
               fallback={<ReportDetailSkeleton />}
               errorTitle="Erro ao carregar dados"
            >
               <ReportData report={report} />
            </QueryBoundary>
         </div>
      </div>
   );
}
