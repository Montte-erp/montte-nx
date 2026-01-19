import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Calendar, ChevronLeft, MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/default/default-header";
import { useDashboardTabs } from "@/features/custom-dashboard/hooks/use-dashboard-tabs";
import { InsightWidget } from "@/features/custom-dashboard/ui/insight-widget";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useTRPC } from "@/integrations/clients";

type InsightViewerPageProps = {
   insightId: string;
};

export function InsightViewerPage({ insightId }: InsightViewerPageProps) {
   const { activeOrganization } = useActiveOrganization();
   const slug = activeOrganization?.slug;
   const navigate = useNavigate();
   const trpc = useTRPC();
   const { openInsightTab, closeTab } = useDashboardTabs();
   const { openAlertDialog } = useAlertDialog();
   const { openCredenza, closeCredenza } = useCredenza();

   // Track if access has been recorded to prevent infinite calls
   const hasRecordedAccess = useRef(false);

   // Fetch insight data
   const {
      data: insight,
      isLoading,
      error: _error,
   } = useQuery(
      trpc.dashboards.getSavedInsight.queryOptions(
         { id: insightId },
         { staleTime: 30000 },
      ),
   );

   // Fetch dashboards for "Add to Dashboard" feature
   const { data: dashboards } = useQuery(
      trpc.dashboards.getAll.queryOptions(undefined, { staleTime: 30000 }),
   );

   // Record access mutation
   const recordAccessMutation = useMutation(
      trpc.dashboards.recordAccess.mutationOptions(),
   );

   // Delete insight mutation
   const deleteInsightMutation = useMutation(
      trpc.dashboards.deleteSavedInsight.mutationOptions({
         onSuccess: () => {
            toast.success("Insight excluído");
            if (slug) {
               navigate({ to: "/$slug/insights", params: { slug } });
            }
         },
         onError: () => {
            toast.error("Falha ao excluir insight");
         },
      }),
   );

   // Add widget to dashboard mutation
   const addWidgetMutation = useMutation(
      trpc.dashboards.addWidget.mutationOptions({
         onSuccess: () => {
            toast.success("Insight adicionado ao dashboard");
            closeCredenza();
         },
         onError: () => {
            toast.error("Falha ao adicionar insight ao dashboard");
         },
      }),
   );

   // Update tab when insight loads
   useEffect(() => {
      if (insight && !hasRecordedAccess.current) {
         hasRecordedAccess.current = true;
         openInsightTab(insightId, insight.name);
         // Record access for recents
         recordAccessMutation.mutate({
            itemType: "insight",
            itemId: insightId,
            itemName: insight.name,
         });
      }
   }, [
      insight,
      insightId,
      openInsightTab, // Record access for recents
      recordAccessMutation.mutate,
   ]);

   // Reset ref when insightId changes (for navigation between insights)
   useEffect(() => {
      hasRecordedAccess.current = false;
   }, []);

   const handleDelete = () => {
      openAlertDialog({
         title: "Excluir Insight",
         description:
            "Tem certeza que deseja excluir este insight? Esta ação não pode ser desfeita.",
         actionLabel: "Excluir",
         variant: "destructive",
         onAction: async () => {
            await deleteInsightMutation.mutateAsync({ id: insightId });
         },
      });
   };

   const handleAddToDashboard = () => {
      openCredenza({
         children: (
            <DashboardSelectorContent
               dashboards={dashboards || []}
               insightConfig={insight?.config as InsightConfig}
               insightName={insight?.name || "Insight"}
               onSelect={(dashboardId) => {
                  addWidgetMutation.mutate({
                     dashboardId,
                     type: "insight",
                     name: insight?.name || "Insight",
                     config: insight?.config as InsightConfig,
                     position: { x: 0, y: 0, w: 6, h: 3 },
                  });
               }}
            />
         ),
      });
   };

   const handleBack = () => {
      closeTab(`insight-${insightId}`);
      if (slug) {
         navigate({ to: "/$slug/dashboards", params: { slug } });
      }
   };

   if (isLoading) {
      return <InsightViewerSkeleton />;
   }

   if (!insight) {
      return (
         <div className="flex min-h-[400px] items-center justify-center">
            <p className="text-muted-foreground">Insight não encontrado</p>
         </div>
      );
   }

   const insightConfig = insight.config as InsightConfig;

   return (
      <div className="p-4 relative">
         <DefaultHeader
            actions={
               <div className="flex items-center gap-2">
                  <Button onClick={handleBack} size="sm" variant="outline">
                     <ChevronLeft className="h-4 w-4 mr-2" />
                     Voltar
                  </Button>
                  <Button size="sm" variant="outline">
                     <Calendar className="h-4 w-4 mr-2" />
                     Últimos 30 dias
                  </Button>
                  <Button onClick={handleAddToDashboard} size="sm">
                     <Plus className="h-4 w-4 mr-2" />
                     Add to Dashboard
                  </Button>
                  <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                           <MoreHorizontal className="h-4 w-4" />
                        </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end">
                        <DropdownMenuItem
                           className="text-destructive focus:text-destructive"
                           onClick={handleDelete}
                        >
                           Excluir
                        </DropdownMenuItem>
                     </DropdownMenuContent>
                  </DropdownMenu>
               </div>
            }
            description={insight.description || "Sem descrição"}
            title={insight.name}
         />

         <div className="mt-6">
            <div className="bg-card border rounded-lg p-6 min-h-[400px]">
               <InsightWidget config={insightConfig} widgetId={insightId} />
            </div>
         </div>
      </div>
   );
}

function InsightViewerSkeleton() {
   return (
      <div className="p-4">
         <div className="flex justify-between items-start mb-6">
            <div>
               <Skeleton className="h-10 w-64 mb-2" />
               <Skeleton className="h-5 w-48" />
            </div>
            <div className="flex gap-2">
               <Skeleton className="h-9 w-24" />
               <Skeleton className="h-9 w-32" />
               <Skeleton className="h-9 w-9" />
            </div>
         </div>
         <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
   );
}

type DashboardSelectorContentProps = {
   dashboards: Array<{ id: string; name: string }>;
   insightConfig: InsightConfig;
   insightName: string;
   onSelect: (dashboardId: string) => void;
};

function DashboardSelectorContent({
   dashboards,
   onSelect,
}: DashboardSelectorContentProps) {
   if (dashboards.length === 0) {
      return (
         <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
               Nenhum dashboard disponível
            </p>
            <p className="text-sm text-muted-foreground">
               Crie um dashboard primeiro para adicionar este insight
            </p>
         </div>
      );
   }

   return (
      <div className="p-4">
         <h3 className="font-semibold mb-4">Select Dashboard</h3>
         <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {dashboards.map((dashboard) => (
               <button
                  className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                  key={dashboard.id}
                  onClick={() => onSelect(dashboard.id)}
                  type="button"
               >
                  {dashboard.name}
               </button>
            ))}
         </div>
      </div>
   );
}
