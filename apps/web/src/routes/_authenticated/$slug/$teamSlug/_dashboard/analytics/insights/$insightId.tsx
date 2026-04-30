import { insightConfigSchema } from "@modules/insights/types";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Clock, Copy, RefreshCw, Tag, Trash2, TrendingUp } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useInsightConfig } from "@/features/analytics/hooks/use-insight-config";
import { InsightBuilder } from "@/features/analytics/ui/insight-builder";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/components/blocks/early-access-banner";
import {
   ContextPanelAction,
   ContextPanelDivider,
   ContextPanelMeta,
} from "@/features/context-panel/context-panel-info";
import { useContextPanelInfo } from "@/features/context-panel/use-context-panel";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";

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

const insightSearchSchema = z.object({
   type: z
      .enum(["kpi", "time_series", "breakdown"])
      .catch("kpi")
      .default("kpi"),
});

function InsightSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <Skeleton className="h-12 w-full" />
         <Skeleton className="h-64 w-full" />
      </div>
   );
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/$insightId",
)({
   validateSearch: insightSearchSchema,
   loader: ({ context, params }) => {
      context.queryClient.prefetchQuery(
         orpc.insights.getById.queryOptions({
            input: { id: params.insightId },
         }),
      );
   },
   pendingMs: 300,
   pendingComponent: InsightSkeleton,
   head: () => ({
      meta: [{ title: "Insight — Montte" }],
   }),
   component: EditInsightPage,
});

const TYPE_LABELS: Record<string, string> = {
   kpi: "KPI",
   time_series: "Série Temporal",
   breakdown: "Distribuição",
};

function EditInsightPage() {
   const { insightId, slug, teamSlug } = Route.useParams();
   const navigate = Route.useNavigate();
   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();

   const { data: insight } = useSuspenseQuery(
      orpc.insights.getById.queryOptions({ input: { id: insightId } }),
   );

   const parsed = insightConfigSchema.safeParse(insight.config);

   const { type, config, setType, updateConfigImmediate } = useInsightConfig(
      parsed.success ? parsed.data : undefined,
   );

   const [name, setName] = useState(insight.name);
   const [description, setDescription] = useState(insight.description ?? "");

   const handleTypeChange = useCallback(
      (newType: "kpi" | "time_series" | "breakdown") => {
         setType(newType);
         navigate({
            search: (prev) => ({ ...prev, type: newType }),
            replace: true,
         });
      },
      [setType, navigate],
   );

   const updateMutation = useMutation(
      orpc.insights.update.mutationOptions({
         onSuccess: () => {
            toast.success("Insight atualizado com sucesso");
            queryClient.invalidateQueries({
               queryKey: orpc.insights.getById.queryOptions({
                  input: { id: insightId },
               }).queryKey,
            });
            queryClient.invalidateQueries({
               queryKey: orpc.insights.list.queryKey({}),
            });
         },
         onError: () => {
            toast.error("Erro ao atualizar insight");
         },
      }),
   );

   const deleteMutation = useMutation(
      orpc.insights.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Insight deletado");
            queryClient.invalidateQueries({
               queryKey: orpc.insights.list.queryKey({}),
            });
            navigate({
               to: "/$slug/$teamSlug/analytics/insights",
               params: { slug, teamSlug },
            });
         },
         onError: () => {
            toast.error("Erro ao deletar insight");
         },
      }),
   );

   const duplicateMutation = useMutation(
      orpc.insights.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Insight duplicado");
            queryClient.invalidateQueries({
               queryKey: orpc.insights.list.queryKey({}),
            });
            navigate({
               to: "/$slug/$teamSlug/analytics/insights/$insightId",
               params: { slug, teamSlug, insightId: data.id },
            });
         },
         onError: () => {
            toast.error("Erro ao duplicar insight");
         },
      }),
   );

   const handleSave = useCallback(() => {
      if (!name.trim()) {
         toast.error("O nome do insight é obrigatório");
         return;
      }
      updateMutation.mutate({
         id: insightId,
         name: name.trim(),
         description: description.trim() || undefined,
         config,
      });
   }, [insightId, name, description, config, updateMutation]);

   const handleDelete = useCallback(() => {
      openAlertDialog({
         title: "Deletar insight",
         description:
            "Tem certeza que deseja deletar este insight? Esta ação não pode ser desfeita.",
         actionLabel: "Deletar",
         onAction: () => deleteMutation.mutate({ id: insightId }),
      });
   }, [insightId, deleteMutation, openAlertDialog]);

   const handleDuplicate = useCallback(() => {
      if (!parsed.success) return;
      duplicateMutation.mutate({
         name: `${insight.name} (cópia)`,
         description: insight.description ?? undefined,
         type: parsed.data.type,
         config: parsed.data,
      });
   }, [insight.name, insight.description, parsed, duplicateMutation]);

   const handleRefresh = useCallback(() => {
      if (!parsed.success) return;
      queryClient.invalidateQueries({
         queryKey: orpc.analytics.query.queryKey({
            input: { config: parsed.data },
         }),
      });
      queryClient.invalidateQueries({
         queryKey: orpc.insights.getById.queryOptions({
            input: { id: insightId },
         }).queryKey,
      });
   }, [queryClient, parsed, insightId]);

   useContextPanelInfo(() => (
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle>{name || insight.name}</ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent>
            <ContextPanelMeta
               icon={Tag}
               label="Tipo"
               value={TYPE_LABELS[type] ?? type}
            />
            <ContextPanelMeta
               icon={Clock}
               label="Calculado"
               value={
                  insight.lastComputedAt
                     ? dayjs(insight.lastComputedAt).format("DD MMM YYYY")
                     : "—"
               }
            />
            <ContextPanelDivider />
            <ContextPanelAction
               icon={Copy}
               label="Duplicar insight"
               onClick={handleDuplicate}
            />
            <ContextPanelAction
               icon={RefreshCw}
               label="Atualizar resultados"
               onClick={handleRefresh}
            />
            <ContextPanelDivider />
            <ContextPanelAction
               icon={Trash2}
               label="Excluir insight"
               onClick={handleDelete}
               variant="destructive"
            />
         </ContextPanelContent>
      </ContextPanel>
   ));

   return (
      <>
         <EarlyAccessBanner template={ANALYTICS_BANNER} />
         <InsightBuilder
            config={config}
            description={description}
            isSaving={updateMutation.isPending}
            lastComputedAt={insight.lastComputedAt}
            name={name}
            onConfigUpdate={updateConfigImmediate}
            onDelete={handleDelete}
            onDescriptionChange={setDescription}
            onDuplicate={handleDuplicate}
            onNameChange={setName}
            onRefresh={handleRefresh}
            onSave={handleSave}
            onTypeChange={handleTypeChange}
            type={type}
         />
      </>
   );
}
