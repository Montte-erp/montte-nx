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
import { useTRPC } from "@/integrations/clients";

function BankAccountsStatsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid gap-4 h-min">
         {createErrorFallback({
            errorDescription:
               "Failed to load bank accounts stats. Please try again later.",
            errorTitle: "Error loading stats",
            retryText: "Retry",
         })(props)}
      </div>
   );
}

function BankAccountsStatsSkeleton() {
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

type BankAccountsStatsContentProps = {
   statusFilter: string;
   typeFilter: string;
};

function BankAccountsStatsContent({
   statusFilter,
   typeFilter,
}: BankAccountsStatsContentProps) {
   const trpc = useTRPC();
   const { data: stats } = useSuspenseQuery(
      trpc.bankAccounts.getStats.queryOptions({
         status: statusFilter
            ? (statusFilter as "active" | "inactive")
            : undefined,
         type: typeFilter
            ? (typeFilter as "checking" | "savings" | "investment")
            : undefined,
      }),
   );

   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-min">
         <StatsCard
            description="Soma de todas as contas"
            title="Saldo Total"
            value={formatDecimalCurrency(stats.totalBalance)}
         />
         <StatsCard
            description="Quantidade de contas cadastradas"
            title="Total de Contas"
            value={stats.totalAccounts}
         />
         <StatsCard
            description="Soma de todas as receitas"
            title="Total de Receitas"
            value={formatDecimalCurrency(stats.totalIncome)}
         />
         <StatsCard
            description="Soma de todas as despesas"
            title="Total de Despesas"
            value={formatDecimalCurrency(stats.totalExpenses)}
         />
      </div>
   );
}

type BankAccountsStatsProps = {
   statusFilter: string;
   typeFilter: string;
};

export function BankAccountsStats({
   statusFilter,
   typeFilter,
}: BankAccountsStatsProps) {
   return (
      <ErrorBoundary FallbackComponent={BankAccountsStatsErrorFallback}>
         <Suspense fallback={<BankAccountsStatsSkeleton />}>
            <BankAccountsStatsContent
               statusFilter={statusFilter}
               typeFilter={typeFilter}
            />
         </Suspense>
      </ErrorBoundary>
   );
}
