import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Skeleton } from "@packages/ui/components/skeleton";
import { StatsCard } from "@packages/ui/components/stats-card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useTRPC } from "@/integrations/clients";

function InterestTemplatesStatsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-min">
         {createErrorFallback({
            errorDescription:
               "Falha ao carregar estatisticas. Tente novamente mais tarde.",
            errorTitle: "Erro ao carregar estatisticas",
            retryText: "Tentar novamente",
         })(props)}
      </div>
   );
}

function InterestTemplatesStatsSkeleton() {
   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-min">
         {[1, 2, 3, 4].map((index) => (
            <Card
               className="col-span-1 h-full w-full"
               key={`stats-skeleton-card-${index + 1}`}
            >
               <CardHeader>
                  <CardTitle>
                     <Skeleton className="h-6 w-24" />
                  </CardTitle>
                  <CardDescription>
                     <Skeleton className="h-4 w-32" />
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <Skeleton className="h-10 w-16" />
               </CardContent>
            </Card>
         ))}
      </div>
   );
}

function InterestTemplatesStatsContent() {
   const trpc = useTRPC();
   const { data: stats } = useSuspenseQuery(
      trpc.interestTemplates.getStats.queryOptions(),
   );

   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-min">
         <StatsCard
            description="Numero total de modelos de juros cadastrados"
            title="Total de Modelos"
            value={stats?.total ?? 0}
         />
         <StatsCard
            description="Modelos ativos disponiveis para uso"
            title="Modelos Ativos"
            value={stats?.totalActive ?? 0}
         />
         <StatsCard
            description="Modelos com multa configurada"
            title="Com Multa"
            value={stats?.withPenalty ?? 0}
         />
         <StatsCard
            description="Modelos com correcao monetaria"
            title="Com Correcao"
            value={stats?.withCorrection ?? 0}
         />
      </div>
   );
}

export function InterestTemplatesStats() {
   return (
      <ErrorBoundary FallbackComponent={InterestTemplatesStatsErrorFallback}>
         <Suspense fallback={<InterestTemplatesStatsSkeleton />}>
            <InterestTemplatesStatsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
