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

function CategoriesStatsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid gap-4 h-min ">
         {createErrorFallback({
            errorDescription:
               "Falha ao carregar estatísticas de categorias. Tente novamente mais tarde.",
            errorTitle: "Erro ao carregar estatísticas",
            retryText: "Tentar novamente",
         })(props)}
      </div>
   );
}

function CategoriesStatsSkeleton() {
   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {Array.from({ length: 4 }).map((_, index) => (
            <div
               className="rounded-xl border bg-card p-4"
               key={`stats-skeleton-${index + 1}`}
            >
               <Skeleton className="h-4 w-24 mb-2" />
               <Skeleton className="h-8 w-16" />
               <Skeleton className="h-3 w-32 mt-2" />
            </div>
         ))}
      </div>
   );
}

function CategoriesStatsContent() {
   const trpc = useTRPC();
   const { data: stats } = useSuspenseQuery(
      trpc.categories.getStats.queryOptions(),
   );

   return (
      <div className="grid gap-4 h-min">
         <div className="grid grid-cols-2 gap-4">
            <StatsCard
               description="Número total de categorias que você criou."
               title="Total de categorias"
               value={stats.totalCategories}
            />
            <StatsCard
               description="A categoria onde você mais gastou dinheiro este mês."
               title="Categoria com maiores gastos"
               value={stats.categoryWithMostTransactions || "N/A"}
            />
         </div>
      </div>
   );
}

export function CategoriesStats() {
   return (
      <ErrorBoundary FallbackComponent={CategoriesStatsErrorFallback}>
         <Suspense fallback={<CategoriesStatsSkeleton />}>
            <CategoriesStatsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
