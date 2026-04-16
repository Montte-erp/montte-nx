import { Button } from "@packages/ui/components/button";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type {
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { Loader2, Plus, TrendingUp } from "lucide-react";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { DEFAULT_KPI_CONFIG } from "@/features/analytics/hooks/use-insight-config";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { ContextPanelAction } from "@/features/context-panel/context-panel-info";
import { useContextPanelInfo } from "@/features/context-panel/use-context-panel";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import { InsightsTable, type InsightRow } from "./-insights/insights-table";

const ANALYTICS_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Analytics Avançado",
   message: "Esta funcionalidade está em fase beta.",
   ctaLabel: "Deixar feedback",
   stage: "beta",
   icon: TrendingUp,
   bullets: [
      "Crie insights personalizados para monitorar receitas, despesas e metas",
      "Analise tendências financeiras e desempenho operacional",
      "Seu feedback nos ajuda a melhorar",
   ],
};

const insightsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
});

type InsightsSearch = z.infer<typeof insightsSearchSchema>;

const [useInsightsTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:insights",
      null,
   );

function InsightsSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/",
)({
   validateSearch: insightsSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.insights.list.queryOptions({}));
   },
   pendingMs: 300,
   pendingComponent: InsightsSkeleton,
   head: () => ({
      meta: [{ title: "Insights — Montte" }],
   }),
   component: InsightsListPage,
});

function InsightsListPage() {
   const navigate = Route.useNavigate();
   const { slug, teamSlug } = Route.useParams();
   const { sorting, columnFilters } = Route.useSearch();
   const [tableState, setTableState] = useInsightsTableState();
   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();
   const [isCreating, startCreateTransition] = useTransition();

   const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      navigate({
         search: (prev: InsightsSearch) => ({ ...prev, sorting: next }),
      });
   };

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
      updater,
   ) => {
      const next =
         typeof updater === "function" ? updater(columnFilters) : updater;
      navigate({
         search: (prev: InsightsSearch) => ({ ...prev, columnFilters: next }),
      });
   };

   const createMutation = useMutation(
      orpc.insights.create.mutationOptions({
         onSuccess: (data) => {
            queryClient.invalidateQueries({
               queryKey: orpc.insights.list.queryKey({}),
            });
            navigate({
               to: "/$slug/$teamSlug/analytics/insights/$insightId",
               params: { slug, teamSlug, insightId: data.id },
            });
         },
         onError: () => {
            toast.error("Erro ao criar insight");
         },
      }),
   );

   const handleCreate = () => {
      if (isCreating) return;
      startCreateTransition(async () => {
         await createMutation.mutateAsync({
            name: "Novo insight",
            type: "kpi",
            config: DEFAULT_KPI_CONFIG,
         });
      });
   };

   useContextPanelInfo(() => (
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle>Ações</ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent>
            <ContextPanelAction
               icon={Plus}
               label="Novo insight"
               onClick={handleCreate}
            />
         </ContextPanelContent>
      </ContextPanel>
   ));

   const { data: insights } = useSuspenseQuery(
      orpc.insights.list.queryOptions({}),
   );

   const deleteMutation = useMutation(
      orpc.insights.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Insight excluído com sucesso");
            queryClient.invalidateQueries({
               queryKey: orpc.insights.list.queryKey({}),
            });
         },
         onError: () => {
            toast.error("Erro ao excluir insight");
         },
      }),
   );

   const handleDelete = useCallback(
      (insight: { id: string; name: string }) => {
         openAlertDialog({
            title: "Excluir insight",
            description: `Tem certeza que deseja excluir "${insight.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: insight.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const handleEdit = useCallback(
      (id: string) => {
         navigate({
            to: "/$slug/$teamSlug/analytics/insights/$insightId",
            params: { slug, teamSlug, insightId: id },
         });
      },
      [navigate, slug, teamSlug],
   );

   return (
      <main className="flex flex-col gap-6">
         <PageHeader
            actions={
               <Button disabled={isCreating} onClick={handleCreate}>
                  {isCreating ? (
                     <Loader2 className="size-4 mr-1 animate-spin" />
                  ) : (
                     <Plus className="size-4 mr-1" />
                  )}
                  Novo insight
               </Button>
            }
            description="Analise eventos, funis e retenção com consultas personalizadas."
            title="Insights"
         />
         <EarlyAccessBanner template={ANALYTICS_BANNER} />
         <InsightsTable
            data={insights as InsightRow[]}
            sorting={sorting as SortingState}
            onSortingChange={handleSortingChange}
            columnFilters={columnFilters as ColumnFiltersState}
            onColumnFiltersChange={handleColumnFiltersChange}
            tableState={tableState}
            onTableStateChange={setTableState}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
         />
      </main>
   );
}
