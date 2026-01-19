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

function CounterpartiesStatsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-min">
         {createErrorFallback({
            errorDescription: "Não foi possível carregar as estatísticas",
            errorTitle: "Erro ao carregar estatísticas",
            retryText: "Tentar novamente",
         })(props)}
      </div>
   );
}

function CounterpartiesStatsSkeleton() {
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

function CounterpartiesStatsContent() {
   const trpc = useTRPC();
   const { data: stats } = useSuspenseQuery(
      trpc.counterparties.getStats.queryOptions(),
   );

   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-min">
         <StatsCard
            description="Total de cadastros"
            title="Total"
            value={stats?.total ?? 0}
         />
         <StatsCard
            description="Cadastros de clientes"
            title="Clientes"
            value={stats?.totalClients ?? 0}
         />
         <StatsCard
            description="Cadastros de fornecedores"
            title="Fornecedores"
            value={stats?.totalSuppliers ?? 0}
         />
         <StatsCard
            description="Cadastros ativos"
            title="Ativos"
            value={stats?.totalActive ?? 0}
         />
      </div>
   );
}

export function CounterpartiesStats() {
   return (
      <ErrorBoundary FallbackComponent={CounterpartiesStatsErrorFallback}>
         <Suspense fallback={<CounterpartiesStatsSkeleton />}>
            <CounterpartiesStatsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
