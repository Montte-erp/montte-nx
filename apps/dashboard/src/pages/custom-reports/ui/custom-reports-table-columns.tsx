import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardAction,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Checkbox } from "@packages/ui/components/checkbox";
import { CollapsibleTrigger } from "@packages/ui/components/collapsible";
import { Separator } from "@packages/ui/components/separator";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { formatDate } from "@packages/utils/date";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   BarChart3,
   Calculator,
   Calendar,
   ChevronDown,
   Download,
   Edit,
   Eye,
   PieChart,
   Target,
   Trash2,
   TrendingUp,
   Users,
   Wallet,
} from "lucide-react";
import { ManageCustomReportForm } from "@/features/custom-report/ui/manage-custom-report-form";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useDeleteCustomReport } from "../features/use-delete-custom-report";
import { useExportPdf } from "../features/use-export-pdf";
import type { CustomReport } from "./custom-reports-page";

const reportTypeConfig = {
   budget_vs_actual: {
      color: "#8b5cf6",
      icon: Target,
      label: "Budget vs Atual",
   },
   cash_flow_forecast: {
      color: "#06b6d4",
      icon: Wallet,
      label: "Fluxo de Caixa",
   },
   category_analysis: {
      color: "#f97316",
      icon: PieChart,
      label: "Análise por Categoria",
   },
   counterparty_analysis: {
      color: "#f59e0b",
      icon: Users,
      label: "Parceiros",
   },
   dre_fiscal: {
      color: "#ec4899",
      icon: Calculator,
      label: "DRE Fiscal",
   },
   dre_gerencial: {
      color: "#10b981",
      icon: BarChart3,
      label: "DRE Gerencial",
   },
   spending_trends: {
      color: "#3b82f6",
      icon: TrendingUp,
      label: "Tendências",
   },
};

function ReportTypeAnnouncement({ type }: { type: string }) {
   const config = reportTypeConfig[type as keyof typeof reportTypeConfig];
   if (!config) {
      return (
         <Announcement>
            <AnnouncementTag>{type}</AnnouncementTag>
         </Announcement>
      );
   }

   const Icon = config.icon;
   return (
      <Announcement>
         <AnnouncementTag
            style={{
               backgroundColor: `${config.color}20`,
               color: config.color,
            }}
         >
            <Icon className="size-3.5" />
         </AnnouncementTag>
         <AnnouncementTitle className="max-w-[120px] truncate">
            {config.label}
         </AnnouncementTitle>
      </Announcement>
   );
}

function CustomReportActionsCell({
   report,
   slug,
}: {
   report: CustomReport;
   slug: string;
}) {
   return (
      <div className="flex justify-end">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        reportId: report.id,
                        slug,
                     }}
                     to="/$slug/custom-reports/$reportId"
                  >
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>Ver Detalhes</TooltipContent>
         </Tooltip>
      </div>
   );
}

export function createCustomReportColumns(
   slug: string,
): ColumnDef<CustomReport>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const report = row.original;
            return (
               <span className="font-medium block max-w-[200px] truncate">
                  {report.name}
               </span>
            );
         },
         enableSorting: false,
         header: "Nome",
      },
      {
         accessorKey: "type",
         cell: ({ row }) => <ReportTypeAnnouncement type={row.original.type} />,
         enableSorting: false,
         header: "Tipo",
      },
      {
         accessorKey: "startDate",
         cell: ({ row }) => {
            const report = row.original;
            return (
               <span className="text-muted-foreground">
                  {formatDate(new Date(report.startDate), "DD MMM YYYY")} -{" "}
                  {formatDate(new Date(report.endDate), "DD MMM YYYY")}
               </span>
            );
         },
         enableSorting: false,
         header: "Período",
      },
      {
         accessorKey: "createdAt",
         cell: ({ row }) => {
            return formatDate(
               new Date(row.getValue("createdAt")),
               "DD MMM YYYY",
            );
         },
         enableSorting: false,
         header: "Criado em",
      },
      {
         cell: ({ row }) => (
            <CustomReportActionsCell report={row.original} slug={slug} />
         ),
         header: "",
         id: "actions",
      },
   ];
}

interface CustomReportExpandedContentProps {
   row: Row<CustomReport>;
}

export function CustomReportExpandedContent({
   row,
}: CustomReportExpandedContentProps) {
   const report = row.original;
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();
   const { deleteReport } = useDeleteCustomReport({ report });
   const { exportPdf, isExporting } = useExportPdf();

   return (
      <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
         <div className="flex flex-col md:flex-row md:items-center gap-4">
            <ReportTypeAnnouncement type={report.type} />
            <Separator className="hidden md:block h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <Calendar className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Período</p>
                  <p className="text-sm font-medium">
                     {formatDate(new Date(report.startDate), "DD MMM YYYY")} -{" "}
                     {formatDate(new Date(report.endDate), "DD MMM YYYY")}
                  </p>
               </div>
            </div>
            {report.description && (
               <>
                  <Separator
                     className="hidden md:block h-8"
                     orientation="vertical"
                  />
                  <p className="text-sm text-muted-foreground max-w-[300px] truncate">
                     {report.description}
                  </p>
               </>
            )}
         </div>

         <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{
                     reportId: report.id,
                     slug: activeOrganization.slug,
                  }}
                  to="/$slug/custom-reports/$reportId"
               >
                  <Eye className="size-4" />
                  Ver Detalhes
               </Link>
            </Button>
            <Button
               disabled={isExporting}
               onClick={() => exportPdf(report.id)}
               size="sm"
               variant="outline"
            >
               <Download className="size-4" />
               Exportar PDF
            </Button>
            <Button
               onClick={(e) => {
                  e.stopPropagation();
                  openSheet({
                     children: <ManageCustomReportForm report={report} />,
                  });
               }}
               size="sm"
               variant="outline"
            >
               <Edit className="size-4" />
               Editar
            </Button>
            <Button
               onClick={(e) => {
                  e.stopPropagation();
                  deleteReport();
               }}
               size="sm"
               variant="destructive"
            >
               <Trash2 className="size-4" />
               Excluir
            </Button>
         </div>
      </div>
   );
}

interface CustomReportMobileCardProps {
   row: Row<CustomReport>;
   isExpanded: boolean;
   toggleExpanded: () => void;
}

export function CustomReportMobileCard({
   row,
   isExpanded,
   toggleExpanded,
}: CustomReportMobileCardProps) {
   const report = row.original;

   return (
      <Card className={isExpanded ? "rounded-b-none py-4" : "py-4"}>
         <CardHeader className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
               <CardTitle className="text-sm truncate">{report.name}</CardTitle>
               <CardDescription>
                  {formatDate(new Date(report.createdAt), "DD MMM YYYY")}
               </CardDescription>
            </div>
            <CardAction>
               <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
               />
            </CardAction>
         </CardHeader>
         <CardContent className="flex flex-wrap items-center gap-2">
            <ReportTypeAnnouncement type={report.type} />
         </CardContent>
         <CardFooter>
            <CollapsibleTrigger asChild>
               <Button
                  className="w-full"
                  onClick={(e) => {
                     e.stopPropagation();
                     toggleExpanded();
                  }}
                  variant="outline"
               >
                  <ChevronDown
                     className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
                  Mais
               </Button>
            </CollapsibleTrigger>
         </CardFooter>
      </Card>
   );
}
