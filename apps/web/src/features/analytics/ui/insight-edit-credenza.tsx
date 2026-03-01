import type {
   BreakdownConfig,
   InsightConfig,
   KpiConfig,
   TimeSeriesConfig,
} from "@packages/analytics/types";
import { insightConfigSchema } from "@packages/analytics/types";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import { cn } from "@packages/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Hash, Loader2, TrendingUp } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import type { InsightType } from "@/features/analytics/hooks/use-insight-config";
import { useInsightConfig } from "@/features/analytics/hooks/use-insight-config";
import { closeCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { BreakdownQueryBuilder } from "./breakdown-query-builder";
import {
   InsightErrorState,
   InsightLoadingState,
   InsightPreview,
} from "./insight-preview";
import { KpiQueryBuilder } from "./kpi-query-builder";
import { TimeSeriesQueryBuilder } from "./time-series-query-builder";

const TYPE_ITEMS: {
   value: InsightType;
   label: string;
   icon: React.ElementType;
}[] = [
   { value: "kpi", label: "KPI", icon: Hash },
   { value: "time_series", label: "Série Temporal", icon: TrendingUp },
   { value: "breakdown", label: "Distribuição", icon: BarChart3 },
];

interface InsightEditCredenzaProps {
   insightId: string;
}

export function InsightEditCredenza({ insightId }: InsightEditCredenzaProps) {
   const queryClient = useQueryClient();

   const { data: insight, isLoading } = useQuery(
      orpc.insights.getById.queryOptions({ input: { id: insightId } }),
   );

   const { type, config, setType, updateConfigImmediate } = useInsightConfig();
   const [name, setName] = useState("");
   const [initialized, setInitialized] = useState(false);

   useEffect(() => {
      if (insight && !initialized) {
         setName(insight.name);
         const parsed = insightConfigSchema.safeParse(insight.config);
         if (parsed.success) {
            setType(parsed.data.type as InsightType);
            queueMicrotask(() => {
               updateConfigImmediate(parsed.data);
            });
         }
         setInitialized(true);
      }
   }, [insight, initialized, setType, updateConfigImmediate]);

   const updateMutation = useMutation(
      orpc.insights.update.mutationOptions({
         onSuccess: () => {
            toast.success("Insight atualizado");
            queryClient.invalidateQueries({
               queryKey: orpc.insights.getById.queryOptions({
                  input: { id: insightId },
               }).queryKey,
            });
            closeCredenza();
         },
         onError: () => toast.error("Erro ao atualizar insight"),
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
         config: config as InsightConfig,
      });
   }, [insightId, name, config, updateMutation]);

   if (isLoading) {
      return (
         <>
            <CredenzaHeader>
               <CredenzaTitle>Configurar insight</CredenzaTitle>
            </CredenzaHeader>
            <CredenzaBody className="h-[500px] flex items-center justify-center">
               <InsightLoadingState />
            </CredenzaBody>
         </>
      );
   }

   return (
      <>
         <CredenzaHeader className="pb-3">
            <CredenzaTitle className="text-base">
               {insight?.name ?? "Configurar insight"}
            </CredenzaTitle>
         </CredenzaHeader>

         <CredenzaBody className="p-0 overflow-hidden">
            <div className="flex h-[500px]">
               {/* ── Left sidebar ── */}
               <aside className="w-[220px] shrink-0 border-r flex flex-col overflow-y-auto">
                  <div className="p-3 flex flex-col gap-3">
                     {/* Name */}
                     <Input
                        className="h-8 text-sm"
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nome do insight"
                        value={name}
                     />

                     <div className="border-t" />

                     {/* Type selector */}
                     <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider px-1 mb-0.5">
                           Tipo
                        </span>
                        {TYPE_ITEMS.map((item) => {
                           const Icon = item.icon;
                           const isActive = type === item.value;
                           return (
                              <button
                                 className={cn(
                                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                                    isActive
                                       ? "bg-primary/10 text-primary font-medium"
                                       : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                                 )}
                                 key={item.value}
                                 onClick={() => setType(item.value)}
                                 type="button"
                              >
                                 <Icon className="size-3.5 shrink-0" />
                                 {item.label}
                              </button>
                           );
                        })}
                     </div>

                     <div className="border-t" />

                     {/* Config builder */}
                     <div className="[&_.space-y-4]:space-y-3 [&_label]:text-[10px]">
                        {type === "kpi" && (
                           <KpiQueryBuilder
                              config={config as KpiConfig}
                              onUpdate={updateConfigImmediate}
                           />
                        )}
                        {type === "time_series" && (
                           <TimeSeriesQueryBuilder
                              config={config as TimeSeriesConfig}
                              onUpdate={updateConfigImmediate}
                           />
                        )}
                        {type === "breakdown" && (
                           <BreakdownQueryBuilder
                              config={config as BreakdownConfig}
                              onUpdate={updateConfigImmediate}
                           />
                        )}
                     </div>
                  </div>
               </aside>

               {/* ── Right preview ── */}
               <div className="flex-1 min-w-0 overflow-y-auto bg-muted/20 p-4">
                  <ErrorBoundary
                     fallbackRender={({ error }) => (
                        <InsightErrorState error={error as Error} />
                     )}
                  >
                     <Suspense fallback={<InsightLoadingState />}>
                        <InsightPreview config={config} />
                     </Suspense>
                  </ErrorBoundary>
               </div>
            </div>
         </CredenzaBody>

         <CredenzaFooter>
            <Button onClick={closeCredenza} variant="outline">
               Cancelar
            </Button>
            <Button disabled={updateMutation.isPending} onClick={handleSave}>
               {updateMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
               )}
               Salvar
            </Button>
         </CredenzaFooter>
      </>
   );
}
