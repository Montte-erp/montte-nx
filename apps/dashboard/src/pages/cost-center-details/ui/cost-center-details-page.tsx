import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { MonthSelector } from "@packages/ui/components/month-selector";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   getDateRangeForPeriod,
   type TimePeriod,
   TimePeriodChips,
   type TimePeriodDateRange,
} from "@packages/ui/components/time-period-chips";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { endOfMonth, startOfMonth } from "date-fns";
import { Edit, Home, Landmark, Plus, Trash2 } from "lucide-react";
import { Suspense, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { DefaultHeader } from "@/default/default-header";
import { TransactionListProvider } from "@/features/transaction/lib/transaction-list-context";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { ManageCostCenterForm } from "../../cost-centers/features/manage-cost-center-form";
import { useDeleteCostCenter } from "../../cost-centers/features/use-delete-cost-center";
import { CostCenterCharts } from "./cost-center-charts";
import { CostCenterStats } from "./cost-center-stats";
import { CostCenterTransactions } from "./cost-center-transactions-section";

function CostCenterContent() {
   const params = useParams({ strict: false });
   const costCenterId =
      (params as { costCenterId?: string }).costCenterId ?? "";
   const trpc = useTRPC();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();

   const [timePeriod, setTimePeriod] = useState<TimePeriod | null>(
      "this-month",
   );
   const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
   const [dateRange, setDateRange] = useState<{
      startDate: Date | null;
      endDate: Date | null;
   }>(() => {
      const range = getDateRangeForPeriod("this-month");
      return { endDate: range.endDate, startDate: range.startDate };
   });

   const handleTimePeriodChange = (
      period: TimePeriod | null,
      range: TimePeriodDateRange,
   ) => {
      setTimePeriod(period);
      setDateRange({ endDate: range.endDate, startDate: range.startDate });
      if (range.selectedMonth) {
         setSelectedMonth(range.selectedMonth);
      }
   };

   const handleMonthChange = (month: Date) => {
      setSelectedMonth(month);
      setTimePeriod(null);
      setDateRange({
         endDate: endOfMonth(month),
         startDate: startOfMonth(month),
      });
   };

   const { data: costCenter } = useSuspenseQuery(
      trpc.costCenters.getById.queryOptions({ id: costCenterId }),
   );

   const handleDeleteSuccess = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/cost-centers",
      });
   };

   const { deleteCostCenter } = useDeleteCostCenter({
      costCenter,
      onSuccess: handleDeleteSuccess,
   });
   if (!costCenterId) {
      return (
         <CostCenterPageError
            error={new Error("Invalid cost center ID")}
            resetErrorBoundary={() => {}}
         />
      );
   }

   if (!costCenter) {
      return null;
   }

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() =>
                     openSheet({
                        children: (
                           <ManageTransactionForm
                              defaultCostCenterId={costCenterId}
                           />
                        ),
                     })
                  }
               >
                  <Plus className="size-4" />
                  Adicionar Nova Transação
               </Button>
            }
            description="Visualize detalhes e estatísticas do centro de custo"
            title={costCenter.name}
         />

         <div className="flex flex-wrap items-center gap-2">
            <Button
               onClick={() =>
                  openSheet({
                     children: <ManageCostCenterForm costCenter={costCenter} />,
                  })
               }
               size="sm"
               variant="outline"
            >
               <Edit className="size-4" />
               Editar Centro de Custo
            </Button>
            <Button
               className="text-destructive hover:text-destructive"
               onClick={deleteCostCenter}
               size="sm"
               variant="outline"
            >
               <Trash2 className="size-4" />
               Excluir Centro de Custo
            </Button>
         </div>

         <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <TimePeriodChips
               onValueChange={handleTimePeriodChange}
               size="sm"
               value={timePeriod}
            />
            <div className="hidden sm:block h-4 w-px bg-border" />
            <MonthSelector
               date={selectedMonth}
               disabled={timePeriod !== null && timePeriod !== "all-time"}
               onSelect={handleMonthChange}
            />
         </div>

         <CostCenterStats
            costCenterId={costCenterId}
            endDate={dateRange.endDate}
            startDate={dateRange.startDate}
         />
         <CostCenterCharts
            costCenterId={costCenterId}
            endDate={dateRange.endDate}
            startDate={dateRange.startDate}
         />
         <CostCenterTransactions
            costCenterId={costCenterId}
            endDate={dateRange.endDate}
            startDate={dateRange.startDate}
         />
      </main>
   );
}

function CostCenterPageSkeleton() {
   return (
      <main className="space-y-4">
         <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-72" />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
         </div>
         <Skeleton className="h-64 w-full" />
      </main>
   );
}

function CostCenterPageError({ error, resetErrorBoundary }: FallbackProps) {
   const { activeOrganization } = useActiveOrganization();
   const router = useRouter();
   return (
      <main className="flex flex-col h-full w-full">
         <div className="flex-1 flex items-center justify-center">
            <Empty>
               <EmptyContent>
                  <EmptyMedia variant="icon">
                     <Landmark className="size-12 text-destructive" />
                  </EmptyMedia>
                  <EmptyTitle>Failed to load cost center</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           router.navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/cost-centers",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <Home className="size-4 mr-2" />
                        Go to Cost Centers
                     </Button>
                     <Button
                        onClick={resetErrorBoundary}
                        size="default"
                        variant="default"
                     >
                        Try Again
                     </Button>
                  </div>
               </EmptyContent>
            </Empty>
         </div>
      </main>
   );
}

export function CostCenterDetailsPage() {
   return (
      <TransactionListProvider>
         <ErrorBoundary FallbackComponent={CostCenterPageError}>
            <Suspense fallback={<CostCenterPageSkeleton />}>
               <CostCenterContent />
            </Suspense>
         </ErrorBoundary>
      </TransactionListProvider>
   );
}
