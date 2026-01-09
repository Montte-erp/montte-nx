import { formatDecimalCurrency } from "@packages/money";
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
import { useTransactionList } from "@/features/transaction/lib/transaction-list-context";
import { useTRPC } from "@/integrations/clients";

function TransactionsStatsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid gap-4 h-min">
         {createErrorFallback({
            errorDescription:
               "Failed to load transactions stats. Please try again later.",
            errorTitle: "Error loading stats",
            retryText: "Retry",
         })(props)}
      </div>
   );
}

function TransactionsStatsSkeleton() {
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

function TransactionsStatsContent() {
   const trpc = useTRPC();
   const { bankAccountFilter, startDate, endDate } = useTransactionList();

   const { data: stats } = useSuspenseQuery(
      trpc.transactions.getStats.queryOptions({
         bankAccountId:
            bankAccountFilter === "all" ? undefined : bankAccountFilter,
         endDate: endDate?.toISOString(),
         startDate: startDate?.toISOString(),
      }),
   );

   return (
      <div className="grid grid-cols-2  md:grid-cols-4 gap-4 h-min">
         <StatsCard
            description="Veja o total acumulado de todas as suas transações."
            title="Total de Transações"
            value={stats.totalTransactions}
         />
         <StatsCard
            description="Veja o total acumulado de todas as suas receitas."
            title="Total de Receitas"
            value={formatDecimalCurrency(stats.totalIncome)}
         />
         <StatsCard
            description="Veja o total acumulado de todas as suas despesas."
            title="Total de Despesas"
            value={formatDecimalCurrency(stats.totalExpenses)}
         />
         <StatsCard
            description="Veja o total acumulado de todas as suas transferências."
            title="Total de Transferências"
            value={formatDecimalCurrency(stats.totalTransfers)}
         />
      </div>
   );
}

export function TransactionsStats() {
   return (
      <ErrorBoundary FallbackComponent={TransactionsStatsErrorFallback}>
         <Suspense fallback={<TransactionsStatsSkeleton />}>
            <TransactionsStatsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
