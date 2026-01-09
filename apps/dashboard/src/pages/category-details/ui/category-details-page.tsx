import { Button } from "@packages/ui/components/button";
import { DateRangePickerPopover } from "@packages/ui/components/date-range-picker-popover";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   getDateRangeForPeriod,
   type TimePeriod,
   TimePeriodChips,
   type TimePeriodDateRange,
} from "@packages/ui/components/time-period-chips";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { FileText, Home, Plus } from "lucide-react";
import { Suspense, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { DefaultHeader } from "@/default/default-header";
import { TransactionListProvider } from "@/features/transaction/lib/transaction-list-context";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { CategoryActionButtons } from "./category-action-buttons";
import { CategoryCharts } from "./category-charts";
import { CategoryMetadataCard } from "./category-metadata-card";
import { CategoryStats } from "./category-stats";
import { CategoryTransactions } from "./category-transactions-section";

function CategoryContent() {
   const params = useParams({ strict: false });
   const categoryId = (params as { categoryId?: string }).categoryId ?? "";
   const trpc = useTRPC();
   const { openSheet } = useSheet();

   const [timePeriod, setTimePeriod] = useState<TimePeriod | null>(
      "this-month",
   );
   const [customDateRange, setCustomDateRange] = useState<{
      startDate: Date | null;
      endDate: Date | null;
   }>({ startDate: null, endDate: null });
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
      if (period === "custom") {
         setDateRange({
            endDate: customDateRange.endDate,
            startDate: customDateRange.startDate,
         });
      } else {
         setDateRange({ endDate: range.endDate, startDate: range.startDate });
      }
   };

   const handleCustomDateChange = (range: {
      startDate: Date | null;
      endDate: Date | null;
   }) => {
      setCustomDateRange(range);
      if (range.startDate && range.endDate) {
         setTimePeriod("custom");
         setDateRange(range);
      }
   };

   const { data: category } = useSuspenseQuery(
      trpc.categories.getById.queryOptions({ id: categoryId }),
   );

   if (!categoryId) {
      return (
         <CategoryPageError
            error={new Error("Invalid category ID")}
            resetErrorBoundary={() => {}}
         />
      );
   }

   if (!category) {
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
                              defaultCategoryIds={[categoryId]}
                           />
                        ),
                     })
                  }
               >
                  <Plus className="size-4" />
                  Adicionar Nova Transação
               </Button>
            }
            description="Detalhes da categoria"
            title={category.name}
         />

         <CategoryActionButtons />

         <div className="flex flex-wrap items-center gap-3">
            <TimePeriodChips
               onValueChange={handleTimePeriodChange}
               scrollable
               size="sm"
               value={timePeriod === "custom" ? null : timePeriod}
            />
            <DateRangePickerPopover
               endDate={customDateRange.endDate}
               onRangeChange={handleCustomDateChange}
               placeholder="Personalizado"
               startDate={customDateRange.startDate}
            />
         </div>

         {/* Grid Layout */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Metadata */}
            <div className="lg:col-span-1 space-y-6">
               <CategoryMetadataCard />
            </div>

            {/* Center Column - Stats & Charts */}
            <div className="lg:col-span-2 space-y-6">
               <CategoryStats
                  categoryId={categoryId}
                  endDate={dateRange.endDate}
                  startDate={dateRange.startDate}
               />
               <CategoryCharts
                  categoryId={categoryId}
                  endDate={dateRange.endDate}
                  startDate={dateRange.startDate}
               />
            </div>

            {/* Full Width - Transactions */}
            <div className="lg:col-span-full">
               <CategoryTransactions
                  categoryId={categoryId}
                  endDate={dateRange.endDate}
                  startDate={dateRange.startDate}
               />
            </div>
         </div>
      </main>
   );
}

function CategoryPageSkeleton() {
   return (
      <main className="space-y-4">
         <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-72" />
         </div>
         <div className="flex gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-32" />
         </div>
         <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
               <Skeleton
                  className="h-8 w-24"
                  key={`period-skeleton-${i + 1}`}
               />
            ))}
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
               <Skeleton className="h-48 w-full" />
            </div>
            <div className="lg:col-span-2 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
               </div>
               <Skeleton className="h-64 w-full" />
            </div>
            <div className="lg:col-span-full">
               <Skeleton className="h-64 w-full" />
            </div>
         </div>
      </main>
   );
}

function CategoryPageError({ error, resetErrorBoundary }: FallbackProps) {
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
                  <EmptyTitle>Failed to load category</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           router.navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/categories",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <Home className="size-4 mr-2" />
                        Go to Categories
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

export function CategoryDetailsPage() {
   return (
      <TransactionListProvider>
         <ErrorBoundary FallbackComponent={CategoryPageError}>
            <Suspense fallback={<CategoryPageSkeleton />}>
               <CategoryContent />
            </Suspense>
         </ErrorBoundary>
      </TransactionListProvider>
   );
}
