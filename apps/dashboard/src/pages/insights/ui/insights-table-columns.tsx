import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Separator } from "@packages/ui/components/separator";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { useRouter } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { BarChart3, Eye, Sparkles, Trash2 } from "lucide-react";
import { ResponsiveEntityExpandedContent } from "@/components/entity-expanded-content";
import { EntityMobileCard } from "@/components/entity-mobile-card";
import { openInsightTab } from "@/features/custom-dashboard/hooks/use-dashboard-tabs";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useDeleteInsight } from "../features/use-delete-insight";
import type { SavedInsight } from "./insights-list-page";

const DATA_SOURCE_LABELS: Record<string, string> = {
   bank_accounts: "Contas",
   bills: "Contas a Pagar/Receber",
   budgets: "Orçamentos",
   transactions: "Transações",
};

const CHART_TYPE_LABELS: Record<string, string> = {
   area: "Área",
   bar: "Barras",
   bar_total: "Barras Total",
   category_analysis: "Análise por Categoria",
   comparison: "Comparativo",
   donut: "Rosca",
   heatmap: "Mapa de Calor",
   line: "Linha",
   line_cumulative: "Linha Cumulativa",
   pie: "Pizza",
   sankey: "Sankey",
   stacked_bar: "Barras Empilhadas",
   stat_card: "Cartão Estatístico",
   table: "Tabela",
   world_map: "Mapa Mundial",
};

// Custom action cell for insights since it uses router navigation instead of Link
function InsightActionsCell({ insight }: { insight: SavedInsight }) {
   const { activeOrganization } = useActiveOrganization();
   const router = useRouter();
   const deleteInsightMutation = useDeleteInsight({});

   const handleOpen = () => {
      openInsightTab(insight.id, insight.name);
      router.navigate({
         to: "/$slug/insights/$insightId",
         params: { slug: activeOrganization.slug, insightId: insight.id },
      });
   };

   const handleDelete = () => {
      deleteInsightMutation.mutate({ id: insight.id });
   };

   return (
      <div className="flex justify-end gap-1">
         <Button onClick={handleOpen} size="icon" variant="outline">
            <Eye className="size-4" />
         </Button>
         <Button
            className="text-destructive hover:text-destructive"
            disabled={deleteInsightMutation.isPending}
            onClick={handleDelete}
            size="icon"
            variant="outline"
         >
            <Trash2 className="size-4" />
         </Button>
      </div>
   );
}

export function createInsightColumns(_slug: string): ColumnDef<SavedInsight>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const insight = row.original;
            return (
               <div className="flex items-center gap-3">
                  <div className="size-8 rounded-sm flex items-center justify-center bg-blue-500/10">
                     <Sparkles className="size-4 text-blue-500" />
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="font-medium">{insight.name}</span>
                     <Badge variant="secondary">
                        {DATA_SOURCE_LABELS[insight.config.dataSource] ||
                           insight.config.dataSource}
                     </Badge>
                  </div>
               </div>
            );
         },
         enableSorting: true,
         header: "Nome",
      },
      {
         cell: ({ row }) => <InsightActionsCell insight={row.original} />,
         header: "",
         id: "actions",
      },
   ];
}

interface InsightExpandedContentProps {
   row: Row<SavedInsight>;
}

export function InsightExpandedContent({ row }: InsightExpandedContentProps) {
   const insight = row.original;
   const { activeOrganization } = useActiveOrganization();
   const router = useRouter();
   const isMobile = useIsMobile();
   const deleteInsightMutation = useDeleteInsight({});

   const handleOpen = () => {
      openInsightTab(insight.id, insight.name);
      router.navigate({
         to: "/$slug/insights/$insightId",
         params: { slug: activeOrganization.slug, insightId: insight.id },
      });
   };

   const handleDelete = () => {
      deleteInsightMutation.mutate({ id: insight.id });
   };

   const mobileContent = (
      <div className="space-y-3">
         <div>
            <p className="text-xs text-muted-foreground">Descrição</p>
            <p className="text-sm">{insight.description || "Sem descrição"}</p>
         </div>
         <Separator />
         <div className="flex items-center gap-4">
            <div>
               <p className="text-xs text-muted-foreground">Fonte de Dados</p>
               <p className="text-sm">
                  {DATA_SOURCE_LABELS[insight.config.dataSource] ||
                     insight.config.dataSource}
               </p>
            </div>
            <div>
               <p className="text-xs text-muted-foreground">Tipo de Gráfico</p>
               <p className="text-sm">
                  {CHART_TYPE_LABELS[insight.config.chartType] ||
                     insight.config.chartType}
               </p>
            </div>
         </div>
         <Separator />
         <div className="flex items-center gap-4">
            <div>
               <p className="text-xs text-muted-foreground">Criado em</p>
               <p className="text-sm">
                  {new Date(insight.createdAt).toLocaleDateString("pt-BR")}
               </p>
            </div>
            <div>
               <p className="text-xs text-muted-foreground">Atualizado em</p>
               <p className="text-sm">
                  {new Date(insight.updatedAt).toLocaleDateString("pt-BR")}
               </p>
            </div>
         </div>
      </div>
   );

   const desktopContent = (
      <div className="flex items-center gap-6">
         <div>
            <p className="text-xs text-muted-foreground">Descrição</p>
            <p className="text-sm max-w-md truncate">
               {insight.description || "Sem descrição"}
            </p>
         </div>
         <Separator className="h-8" orientation="vertical" />
         <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" />
            <div>
               <p className="text-xs text-muted-foreground">Tipo de Gráfico</p>
               <p className="text-sm">
                  {CHART_TYPE_LABELS[insight.config.chartType] ||
                     insight.config.chartType}
               </p>
            </div>
         </div>
         <Separator className="h-8" orientation="vertical" />
         <div>
            <p className="text-xs text-muted-foreground">Criado em</p>
            <p className="text-sm">
               {new Date(insight.createdAt).toLocaleDateString("pt-BR")}
            </p>
         </div>
      </div>
   );

   // Custom actions for insights (uses router navigation, not Link)
   const mobileActions = (
      <div className="space-y-2">
         <Button
            className="w-full justify-start"
            onClick={handleOpen}
            size="sm"
            variant="outline"
         >
            <Eye className="size-4" />
            Ver insight
         </Button>
         <Button
            className="w-full justify-start text-destructive hover:text-destructive"
            disabled={deleteInsightMutation.isPending}
            onClick={handleDelete}
            size="sm"
            variant="outline"
         >
            <Trash2 className="size-4" />
            Excluir insight
         </Button>
      </div>
   );

   const desktopActions = (
      <div className="flex items-center gap-2">
         <Button onClick={handleOpen} size="sm" variant="outline">
            <Eye className="size-4" />
            Ver insight
         </Button>
         <Button
            disabled={deleteInsightMutation.isPending}
            onClick={handleDelete}
            size="sm"
            variant="destructive"
         >
            <Trash2 className="size-4" />
            Excluir
         </Button>
      </div>
   );

   return (
      <ResponsiveEntityExpandedContent
         desktopActions={desktopActions}
         desktopContent={desktopContent}
         isMobile={isMobile}
         mobileActions={mobileActions}
         mobileContent={mobileContent}
      />
   );
}

interface InsightMobileCardProps {
   row: Row<SavedInsight>;
   isExpanded: boolean;
   toggleExpanded: () => void;
}

export function InsightMobileCard({
   row,
   isExpanded,
   toggleExpanded,
}: InsightMobileCardProps) {
   const insight = row.original;

   return (
      <EntityMobileCard
         content={
            <Badge className="mt-1" variant="secondary">
               {DATA_SOURCE_LABELS[insight.config.dataSource] ||
                  insight.config.dataSource}
            </Badge>
         }
         icon={
            <div className="size-10 rounded-sm flex items-center justify-center bg-blue-500/10">
               <Sparkles className="size-5 text-blue-500" />
            </div>
         }
         isExpanded={isExpanded}
         title={insight.name}
         toggleExpanded={toggleExpanded}
      />
   );
}
