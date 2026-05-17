import { Button } from "@packages/ui/components/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
   ArrowLeft,
   CalendarDays,
   FileDown,
   Filter,
   ReceiptText,
} from "lucide-react";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";
import { QueryBoundary } from "@/components/query-boundary";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
import { REPORT_LABELS, type SavedReport } from "../-reports/report-labels";
import { ReportData } from "../-reports/report-panels";
import { DefaultHeader } from "../../-layout/default-header";

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
   const navigate = useNavigate();
   const { data: report } = useSuspenseQuery(
      orpc.reports.get.queryOptions({ input: { id: reportId } }),
   );

   return (
      <div className="flex flex-1 min-h-0 flex-col gap-4">
         <DefaultHeader
            description={
               <>
                  {REPORT_LABELS[report.type].label} ·{" "}
                  {dayjs(report.config.dateFrom).format("DD/MM/YYYY")} —{" "}
                  {dayjs(report.config.dateTo).format("DD/MM/YYYY")}
               </>
            }
            onBack={() =>
               navigate({
                  to: "/$slug/$teamSlug/reports",
                  params: { slug, teamSlug },
               })
            }
            secondaryActions={<ReportDetailToolbar report={report} />}
            title={report.name}
         />

         <div className="flex min-h-0 flex-1 flex-col overflow-auto">
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

function ReportDetailToolbar({ report }: { report: SavedReport }) {
   const statusLabel =
      report.config.status === "paid"
         ? "Realizados"
         : report.config.status === "pending"
           ? "Planejados"
           : "Realizados e planejados";

   return (
      <div className="flex w-full flex-wrap items-center gap-2">
         <Announcement className="cursor-default shadow-none hover:shadow-none">
            <AnnouncementTag>
               <ReceiptText className="size-3" />
            </AnnouncementTag>
            <AnnouncementTitle>
               {REPORT_LABELS[report.type].label}
            </AnnouncementTitle>
         </Announcement>
         <Announcement className="cursor-default shadow-none hover:shadow-none">
            <AnnouncementTag>
               <CalendarDays className="size-3" />
            </AnnouncementTag>
            <AnnouncementTitle>
               {dayjs(report.config.dateFrom).format("DD/MM/YYYY")} —{" "}
               {dayjs(report.config.dateTo).format("DD/MM/YYYY")}
            </AnnouncementTitle>
         </Announcement>
         <Announcement className="cursor-default shadow-none hover:shadow-none">
            <AnnouncementTag>
               <Filter className="size-3" />
            </AnnouncementTag>
            <AnnouncementTitle>{statusLabel}</AnnouncementTitle>
         </Announcement>
         {report.type === "dre" && report.config.dreOnly ? (
            <Announcement className="cursor-default shadow-none hover:shadow-none">
               <AnnouncementTitle>Somente categorias DRE</AnnouncementTitle>
            </Announcement>
         ) : null}
         <div className="flex flex-1 justify-end">
            <Button
               onClick={() => window.print()}
               size="icon-sm"
               tooltip="Exportar PDF"
               variant="outline"
            >
               <FileDown />
               <span className="sr-only">Exportar PDF</span>
            </Button>
         </div>
      </div>
   );
}
