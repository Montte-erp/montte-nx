import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import {
   DataTable,
   type MobileCardRenderProps,
} from "@packages/ui/components/data-table";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
   AlertCircle,
   GitBranch,
   Lightbulb,
   Loader2,
   Pencil,
   Plus,
   RotateCcw,
   Trash2,
   TrendingUp,
} from "lucide-react";
import { useMemo, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { ContextPanelAction } from "@/features/context-panel/context-panel-info";
import { useContextPanelInfo } from "@/features/context-panel/use-context-panel";
import { DEFAULT_KPI_CONFIG } from "@/features/analytics/hooks/use-insight-config";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";

const ANALYTICS_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Analytics Avançado",
   message: "Esta funcionalidade está em fase beta.",
   ctaLabel: "Deixar feedback",
   bullets: [
      "Crie insights personalizados para monitorar qualquer evento",
      "Analise tendências, funis e retenção de usuários",
      "Seu feedback nos ajuda a melhorar",
   ],
};

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.insights.list.queryOptions({}));
   },
   component: InsightsListPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InsightRow {
   id: string;
   name: string;
   description?: string | null;
   type: string;
   updatedAt: string | Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
   trends: "Tendências",
   funnels: "Funis",
   retention: "Retenção",
};

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
   trends: "default",
   funnels: "secondary",
   retention: "outline",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
   trends: TrendingUp,
   funnels: GitBranch,
   retention: RotateCcw,
};

function formatDate(date: string | Date): string {
   return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
   });
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ListSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton className="h-14 w-full" key={`skeleton-${i + 1}`} />
         ))}
      </div>
   );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
   return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
         <div className="size-14 rounded-full bg-muted flex items-center justify-center">
            <Lightbulb className="size-7 text-muted-foreground" />
         </div>
         <div className="space-y-1">
            <h3 className="text-lg font-semibold">Nenhum insight ainda</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
               Crie seu primeiro insight para visualizar dados de eventos, funis
               de conversão ou retenção de usuários.
            </p>
         </div>
         <Button onClick={onCreateClick}>
            <Plus className="size-4" />
            Criar primeiro insight
         </Button>
      </div>
   );
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------

function InsightMobileCard({
   row,
   slug,
   teamSlug,
   navigate,
   onDelete,
}: MobileCardRenderProps<InsightRow> & {
   slug: string;
   teamSlug: string;
   navigate: ReturnType<typeof useNavigate>;
   onDelete: (insight: { id: string; name: string }) => void;
}) {
   const insight = row.original;
   const TypeIcon = TYPE_ICONS[insight.type] ?? Lightbulb;
   return (
      <Card>
         <CardContent className="p-4">
            <div className="flex items-start gap-3">
               <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <TypeIcon className="size-4 text-primary" />
               </div>
               <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{insight.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                     <Badge
                        className="text-xs"
                        variant={TYPE_VARIANTS[insight.type] ?? "default"}
                     >
                        {TYPE_LABELS[insight.type] ?? insight.type}
                     </Badge>
                     <span className="text-xs text-muted-foreground">
                        {formatDate(insight.updatedAt)}
                     </span>
                  </div>
               </div>
               <div className="flex items-center gap-1">
                  <Button
                     onClick={() =>
                        navigate({
                           to: "/$slug/$teamSlug/analytics/insights/$insightId",
                           params: { slug, teamSlug, insightId: insight.id },
                        })
                     }
                     size="icon"
                     variant="ghost"
                  >
                     <Pencil className="size-4" />
                     <span className="sr-only">Editar</span>
                  </Button>
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() =>
                        onDelete({ id: insight.id, name: insight.name })
                     }
                     size="icon"
                     variant="ghost"
                  >
                     <Trash2 className="size-4" />
                     <span className="sr-only">Excluir</span>
                  </Button>
               </div>
            </div>
         </CardContent>
      </Card>
   );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function InsightsListPage() {
   const navigate = useNavigate();
   const { slug, teamSlug } = Route.useParams();
   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();
   const [isCreating, startCreateTransition] = useTransition();

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

   useContextPanelInfo(
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
      </ContextPanel>,
   );

   const {
      data: insights,
      isLoading,
      error,
   } = useQuery(orpc.insights.list.queryOptions({}));

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

   const columns = useMemo<ColumnDef<InsightRow>[]>(
      () => [
         {
            id: "name",
            header: "Nome",
            cell: ({ row }) => {
               const insight = row.original;
               const TypeIcon = TYPE_ICONS[insight.type] ?? Lightbulb;
               return (
                  <div className="flex items-center gap-3">
                     <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <TypeIcon className="size-4 text-primary" />
                     </div>
                     <div className="min-w-0">
                        <p className="font-medium truncate">{insight.name}</p>
                        {insight.description && (
                           <p className="text-xs text-muted-foreground truncate">
                              {insight.description}
                           </p>
                        )}
                     </div>
                  </div>
               );
            },
         },
         {
            id: "type",
            header: "Tipo",
            cell: ({ row }) => (
               <Badge variant={TYPE_VARIANTS[row.original.type] ?? "default"}>
                  {TYPE_LABELS[row.original.type] ?? row.original.type}
               </Badge>
            ),
         },
         {
            id: "updatedAt",
            header: "Atualizado",
            cell: ({ row }) => (
               <span className="text-muted-foreground text-sm">
                  {formatDate(row.original.updatedAt)}
               </span>
            ),
         },
         {
            id: "actions",
            header: "",
            cell: ({ row }) => {
               const insight = row.original;
               return (
                  <div className="flex items-center justify-end gap-1">
                     <Button
                        onClick={() =>
                           navigate({
                              to: "/$slug/$teamSlug/analytics/insights/$insightId",
                              params: { slug, teamSlug, insightId: insight.id },
                           })
                        }
                        size="icon"
                        variant="ghost"
                     >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Editar</span>
                     </Button>
                     <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                           handleDelete({ id: insight.id, name: insight.name })
                        }
                        size="icon"
                        variant="ghost"
                     >
                        <Trash2 className="size-3.5" />
                        <span className="sr-only">Excluir</span>
                     </Button>
                  </div>
               );
            },
         },
      ],
      [navigate, slug, teamSlug, handleDelete],
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

         {isLoading && <ListSkeleton />}
         {error && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
               <AlertCircle className="size-8 text-destructive/60" />
               <p className="text-sm">
                  Erro ao carregar insights: {error.message}
               </p>
            </div>
         )}
         {!isLoading && !error && insights?.length === 0 && (
            <EmptyState onCreateClick={handleCreate} />
         )}
         {!isLoading && !error && insights && insights.length > 0 && (
            <DataTable
               columns={columns}
               data={insights as InsightRow[]}
               getRowId={(row) => row.id}
               renderMobileCard={(props) => (
                  <InsightMobileCard
                     {...props}
                     navigate={navigate}
                     onDelete={handleDelete}
                     slug={slug}
                     teamSlug={teamSlug}
                  />
               )}
            />
         )}
      </main>
   );
}
