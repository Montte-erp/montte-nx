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

type BillsStatsProps = {
   type?: "payable" | "receivable";
};

function BillsStatsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-min">
         {createErrorFallback({
            errorDescription: "Erro ao carregar estatísticas",
            errorTitle: "Erro ao carregar estatísticas",
            retryText: "Tentar novamente",
         })(props)}
      </div>
   );
}

function BillsStatsSkeleton() {
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

function BillsStatsContent({ type }: BillsStatsProps) {
   const trpc = useTRPC();
   const { data: stats } = useSuspenseQuery(trpc.bills.getStats.queryOptions());

   if (type === "payable") {
      return (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-min">
            <StatsCard
               description="Total de contas a pagar"
               title="A Pagar"
               value={formatDecimalCurrency(stats?.totalPendingPayables ?? 0)}
            />
            <StatsCard
               description="Contas a pagar vencidas"
               title="Vencidas a Pagar"
               value={stats?.totalOverduePayables || 0}
            />
            <StatsCard
               description="Total de contas a receber"
               title="A Receber"
               value={formatDecimalCurrency(
                  stats?.totalPendingReceivables ?? 0,
               )}
            />
            <StatsCard
               description="Total de contas vencidas"
               title="Total Vencido"
               value={stats?.totalOverdue || 0}
            />
         </div>
      );
   }

   if (type === "receivable") {
      return (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-min">
            <StatsCard
               description="Total de contas a receber"
               title="A Receber"
               value={formatDecimalCurrency(
                  stats?.totalPendingReceivables ?? 0,
               )}
            />
            <StatsCard
               description="Contas a receber vencidas"
               title="Vencidas a Receber"
               value={stats?.totalOverdueReceivables || 0}
            />
            <StatsCard
               description="Total de contas a pagar"
               title="A Pagar"
               value={formatDecimalCurrency(stats?.totalPendingPayables ?? 0)}
            />
            <StatsCard
               description="Total de contas vencidas"
               title="Total Vencido"
               value={stats?.totalOverdue || 0}
            />
         </div>
      );
   }

   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-min">
         <StatsCard
            description="Total de contas a pagar"
            title="A Pagar"
            value={formatDecimalCurrency(stats?.totalPendingPayables ?? 0)}
         />
         <StatsCard
            description="Total de contas a receber"
            title="A Receber"
            value={formatDecimalCurrency(stats?.totalPendingReceivables ?? 0)}
         />
         <StatsCard
            description="Contas a pagar vencidas"
            title="Vencidas a Pagar"
            value={stats?.totalOverduePayables || 0}
         />
         <StatsCard
            description="Contas a receber vencidas"
            title="Vencidas a Receber"
            value={stats?.totalOverdueReceivables || 0}
         />
      </div>
   );
}

export function BillsStats({ type }: BillsStatsProps) {
   return (
      <ErrorBoundary FallbackComponent={BillsStatsErrorFallback}>
         <Suspense fallback={<BillsStatsSkeleton />}>
            <BillsStatsContent type={type} />
         </Suspense>
      </ErrorBoundary>
   );
}
