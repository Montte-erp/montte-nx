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

function TagStatsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid gap-4 h-min">
         {createErrorFallback({
            errorDescription:
               "Falha ao carregar estatísticas. Por favor, tente novamente.",
            errorTitle: "Erro ao carregar estatísticas",
            retryText: "Tentar novamente",
         })(props)}
      </div>
   );
}

function TagStatsSkeleton() {
   return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         {[1, 2, 3].map((index) => (
            <Card
               className="col-span-1 h-full w-full"
               key={`stats-skeleton-${index}`}
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

function TagStatsContent({
   tagId,
   startDate,
   endDate,
}: {
   tagId: string;
   startDate: Date | null;
   endDate: Date | null;
}) {
   const trpc = useTRPC();

   const { data } = useSuspenseQuery(
      trpc.transactions.getAllPaginated.queryOptions({
         endDate: endDate?.toISOString(),
         limit: 100,
         page: 1,
         startDate: startDate?.toISOString(),
         tagId,
      }),
   );

   const income = data.transactions
      .filter((t: { type: string }) => t.type === "income")
      .reduce(
         (acc: number, curr: { amount: string }) =>
            acc + parseFloat(curr.amount),
         0,
      );

   const expense = data.transactions
      .filter((t: { type: string }) => t.type === "expense")
      .reduce(
         (acc: number, curr: { amount: string }) =>
            acc + Math.abs(parseFloat(curr.amount)),
         0,
      );

   return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <StatsCard
            description="Veja o total acumulado de todas as suas transações."
            title="Total de Transações"
            value={data.pagination.totalCount}
         />
         <StatsCard
            description="Veja o total acumulado de todas as suas receitas."
            title="Total de Receitas"
            value={new Intl.NumberFormat("pt-BR", {
               currency: "BRL",
               style: "currency",
            }).format(income)}
         />
         <StatsCard
            description="Veja o total acumulado de todas as suas despesas."
            title="Total de Despesas"
            value={new Intl.NumberFormat("pt-BR", {
               currency: "BRL",
               style: "currency",
            }).format(expense)}
         />
      </div>
   );
}

export function TagStats({
   tagId,
   startDate,
   endDate,
}: {
   tagId: string;
   startDate: Date | null;
   endDate: Date | null;
}) {
   return (
      <ErrorBoundary FallbackComponent={TagStatsErrorFallback}>
         <Suspense fallback={<TagStatsSkeleton />}>
            <TagStatsContent
               endDate={endDate}
               startDate={startDate}
               tagId={tagId}
            />
         </Suspense>
      </ErrorBoundary>
   );
}
