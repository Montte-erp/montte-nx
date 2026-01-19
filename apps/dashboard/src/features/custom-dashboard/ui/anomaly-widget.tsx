import { formatDecimalCurrency } from "@packages/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
   AlertTriangle,
   Check,
   Clock,
   Tag,
   TrendingUp,
   Zap,
} from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTRPC, useTRPCClient } from "@/integrations/clients";

type AnomalyWidgetConfig = {
   type: "anomaly_card";
   limit?: number;
   showAcknowledged?: boolean;
};

type AnomalyWidgetProps = {
   config: AnomalyWidgetConfig;
};

const severityColors = {
   low: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
   medium: "bg-orange-500/10 text-orange-600 border-orange-500/20",
   high: "bg-red-500/10 text-red-600 border-red-500/20",
};

const severityLabels = {
   low: "Baixa",
   medium: "Média",
   high: "Alta",
};

const typeIcons = {
   spending_spike: TrendingUp,
   unusual_category: Tag,
   large_transaction: Zap,
   unusual_time: Clock,
};

function AnomalyWidgetSkeleton() {
   return (
      <div className="h-full flex flex-col gap-3 p-1">
         {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
               className="h-20 w-full"
               key={`anomaly-skeleton-${i + 1}`}
            />
         ))}
      </div>
   );
}

function AnomalyWidgetError() {
   return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
         Erro ao carregar anomalias
      </div>
   );
}

function AnomalyWidgetEmpty() {
   return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
         <div className="rounded-full bg-green-500/10 p-3 mb-3">
            <Check className="size-6 text-green-500" />
         </div>
         <p className="text-sm font-medium">Tudo normal!</p>
         <p className="text-xs text-muted-foreground mt-1">
            Nenhuma anomalia detectada nos seus gastos.
         </p>
      </div>
   );
}

function AnomalyWidgetContent({ config }: AnomalyWidgetProps) {
   const trpc = useTRPC();
   const trpcClient = useTRPCClient();

   const { data: anomalies, refetch } = useSuspenseQuery(
      trpc.dashboards.getAnomalies.queryOptions({
         includeAcknowledged: config.showAcknowledged,
         limit: config.limit ?? 5,
      }),
   );

   const acknowledgeMutation = useMutation({
      mutationFn: (id: string) =>
         trpcClient.dashboards.acknowledgeAnomaly.mutate({ id }),
      onSuccess: () => {
         refetch();
      },
   });

   if (anomalies.length === 0) {
      return <AnomalyWidgetEmpty />;
   }

   return (
      <div className="h-full flex flex-col gap-2 overflow-y-auto p-1">
         {anomalies.map((anomaly) => {
            const Icon =
               typeIcons[anomaly.type as keyof typeof typeIcons] ??
               AlertTriangle;
            const severity = anomaly.severity as keyof typeof severityColors;

            return (
               <Card
                  className={cn(
                     "border transition-colors",
                     severityColors[severity],
                  )}
                  key={anomaly.id}
               >
                  <CardHeader className="p-3">
                     <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                           <div
                              className={cn(
                                 "rounded-full p-1.5 shrink-0",
                                 severity === "high"
                                    ? "bg-red-500/20"
                                    : severity === "medium"
                                      ? "bg-orange-500/20"
                                      : "bg-yellow-500/20",
                              )}
                           >
                              <Icon className="size-3" />
                           </div>
                           <div className="min-w-0">
                              <CardTitle className="text-sm truncate">
                                 {anomaly.title}
                              </CardTitle>
                              {anomaly.amount && (
                                 <p className="text-xs font-medium mt-0.5">
                                    {formatDecimalCurrency(
                                       Number(anomaly.amount),
                                    )}
                                 </p>
                              )}
                           </div>
                        </div>
                        <Badge
                           className="shrink-0 text-[10px]"
                           variant="outline"
                        >
                           {severityLabels[severity]}
                        </Badge>
                     </div>
                     {anomaly.description && (
                        <CardDescription className="text-xs mt-2 line-clamp-2">
                           {anomaly.description}
                        </CardDescription>
                     )}
                     {!anomaly.isAcknowledged && (
                        <Button
                           className="mt-2 h-7 text-xs w-full"
                           disabled={acknowledgeMutation.isPending}
                           onClick={() =>
                              acknowledgeMutation.mutate(anomaly.id)
                           }
                           size="sm"
                           variant="ghost"
                        >
                           <Check className="size-3 mr-1" />
                           Reconhecer
                        </Button>
                     )}
                  </CardHeader>
               </Card>
            );
         })}
      </div>
   );
}

export function AnomalyWidget({ config }: AnomalyWidgetProps) {
   return (
      <ErrorBoundary FallbackComponent={AnomalyWidgetError}>
         <Suspense fallback={<AnomalyWidgetSkeleton />}>
            <AnomalyWidgetContent config={config} />
         </Suspense>
      </ErrorBoundary>
   );
}
