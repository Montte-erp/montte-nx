import { translate } from "@packages/localization";
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
import { FileText, Home, Plus } from "lucide-react";
import { Suspense, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { DefaultHeader } from "@/default/default-header";
import { TransactionListProvider } from "@/features/transaction/lib/transaction-list-context";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { BudgetActionButtons } from "./budget-action-buttons";
import { BudgetDetailsStats } from "./budget-details-stats";
import { BudgetInformationSection } from "./budget-information-section";
import { BudgetMetadataCard } from "./budget-metadata-card";
import { BudgetProgressSection } from "./budget-progress-section";
import { BudgetTransactionsSection } from "./budget-transactions-section";

function BudgetContent() {
   const params = useParams({ strict: false });
   const budgetId = (params as { budgetId?: string }).budgetId ?? "";
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

   const { data: budget } = useSuspenseQuery(
      trpc.budgets.getById.queryOptions({ id: budgetId }),
   );

   const handleDeleteSuccess = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/budgets",
      });
   };

   if (!budgetId) {
      return (
         <BudgetPageError
            error={new Error("Invalid budget ID")}
            resetErrorBoundary={() => {}}
         />
      );
   }

   if (!budget) {
      return null;
   }

   const target = budget.target as
      | { type: "category"; categoryId: string }
      | { type: "categories"; categoryIds: string[] }
      | { type: "tag"; tagId: string }
      | { type: "cost_center"; costCenterId: string };

   const defaultCategoryIds =
      target.type === "category"
         ? [target.categoryId]
         : target.type === "categories"
           ? target.categoryIds
           : [];

   const defaultTagIds = target.type === "tag" ? [target.tagId] : [];

   const defaultCostCenterId =
      target.type === "cost_center" ? target.costCenterId : "";

   return (
      <main className="space-y-6">
         <DefaultHeader
            actions={
               <Button
                  onClick={() =>
                     openSheet({
                        children: (
                           <ManageTransactionForm
                              defaultCategoryIds={defaultCategoryIds}
                              defaultCostCenterId={defaultCostCenterId}
                              defaultTagIds={defaultTagIds}
                           />
                        ),
                     })
                  }
               >
                  <Plus className="size-4" />
                  {translate(
                     "dashboard.routes.transactions.features.add-new.title",
                  )}
               </Button>
            }
            description={translate(
               "dashboard.routes.budgets.details.page.description",
            )}
            title={budget.name}
         />

         <BudgetActionButtons
            budget={budget}
            onDeleteSuccess={handleDeleteSuccess}
         />

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

         {/* Bento Grid Layout */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
               <BudgetMetadataCard budgetId={budgetId} />
               <BudgetDetailsStats budget={budget} />
            </div>
            <div className="lg:col-span-2 space-y-6">
               <BudgetProgressSection budget={budget} />
            </div>
            <div className="lg:col-span-full">
               <BudgetTransactionsSection
                  budget={budget}
                  endDate={dateRange.endDate}
                  startDate={dateRange.startDate}
               />
            </div>
            <div className="lg:col-span-full">
               <BudgetInformationSection budget={budget} />
            </div>
         </div>
      </main>
   );
}

function BudgetPageSkeleton() {
   return (
      <main className="space-y-6">
         <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-72" />
         </div>
         <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-32" />
         </div>
         <div className="flex gap-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-24" />
         </div>
         {/* Bento Grid Skeleton */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
               <Skeleton className="h-48 w-full" />
               <Skeleton className="h-32 w-full" />
            </div>
            <div className="lg:col-span-2 space-y-6">
               <Skeleton className="h-[350px] w-full" />
            </div>
            <div className="lg:col-span-full">
               <Skeleton className="h-64 w-full" />
            </div>
            <div className="lg:col-span-full">
               <Skeleton className="h-32 w-full" />
            </div>
         </div>
      </main>
   );
}

function BudgetPageError({ error, resetErrorBoundary }: FallbackProps) {
   const { activeOrganization } = useActiveOrganization();
   const router = useRouter();
   return (
      <main className="flex flex-col h-full w-full">
         <div className="flex-1 flex items-center justify-center">
            <Empty>
               <EmptyContent>
                  <EmptyMedia variant="icon">
                     <FileText className="size-12 text-destructive" />
                  </EmptyMedia>
                  <EmptyTitle>
                     {translate("dashboard.routes.budgets.details.error.title")}
                  </EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           router.navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/budgets",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <Home className="size-4 mr-2" />
                        {translate(
                           "dashboard.routes.budgets.details.error.back",
                        )}
                     </Button>
                     <Button
                        onClick={resetErrorBoundary}
                        size="default"
                        variant="default"
                     >
                        {translate("common.actions.retry")}
                     </Button>
                  </div>
               </EmptyContent>
            </Empty>
         </div>
      </main>
   );
}

export function BudgetDetailsPage() {
   return (
      <TransactionListProvider>
         <ErrorBoundary FallbackComponent={BudgetPageError}>
            <Suspense fallback={<BudgetPageSkeleton />}>
               <BudgetContent />
            </Suspense>
         </ErrorBoundary>
      </TransactionListProvider>
   );
}
