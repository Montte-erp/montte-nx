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

function BudgetsStatsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid gap-4 h-min">
         {createErrorFallback({
            errorDescription:
               "Não foi possível carregar os orçamentos. Tente novamente.",
            errorTitle: "Erro ao carregar orçamentos",
            retryText: "Tentar novamente",
         })(props)}
      </div>
   );
}

function BudgetsStatsSkeleton() {
   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

function formatCurrency(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      currency: "BRL",
      style: "currency",
   }).format(value);
}

function BudgetsStatsContent() {
   const trpc = useTRPC();
   const { data: stats } = useSuspenseQuery(
      trpc.budgets.getStats.queryOptions(),
   );

   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <StatsCard
            description="Número de orçamentos ativos"
            title="Total de orçamentos"
            value={stats.activeBudgets}
         />
         <StatsCard
            description="Soma de todos os limites"
            title="Total orçado"
            value={formatCurrency(stats.totalBudgeted)}
         />
         <StatsCard
            description="Soma de todos os gastos realizados"
            title="Total gasto"
            value={formatCurrency(stats.totalSpent)}
         />
         <StatsCard
            description="Quanto ainda pode ser gasto"
            title="Total disponível"
            value={formatCurrency(stats.totalAvailable)}
         />
      </div>
   );
}

export function BudgetsStats() {
   return (
      <ErrorBoundary FallbackComponent={BudgetsStatsErrorFallback}>
         <Suspense fallback={<BudgetsStatsSkeleton />}>
            <BudgetsStatsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
