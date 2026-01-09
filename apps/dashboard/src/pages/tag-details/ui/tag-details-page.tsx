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
import { Home, Plus, Tag } from "lucide-react";
import { Suspense, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { DefaultHeader } from "@/default/default-header";
import { TransactionListProvider } from "@/features/transaction/lib/transaction-list-context";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { TagActionButtons } from "./tag-action-buttons";
import { TagCharts } from "./tag-charts";
import { TagMetadataCard } from "./tag-metadata-card";
import { TagStats } from "./tag-stats";
import { TagTransactions } from "./tag-transactions-section";

function TagContent() {
   const params = useParams({ strict: false });
   const tagId = (params as { tagId?: string }).tagId ?? "";
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

   const { data: tag } = useSuspenseQuery(
      trpc.tags.getById.queryOptions({ id: tagId }),
   );

   if (!tagId) {
      return (
         <TagPageError
            error={new Error("Invalid tag ID")}
            resetErrorBoundary={() => {}}
         />
      );
   }

   if (!tag) {
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
                           <ManageTransactionForm defaultTagIds={[tagId]} />
                        ),
                     })
                  }
               >
                  <Plus className="size-4" />
                  Adicionar Nova Transação
               </Button>
            }
            description="Visualize e gerencie suas tags aqui."
            title={tag.name}
         />

         <TagActionButtons />

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
               <TagMetadataCard />
            </div>

            {/* Center Column - Stats & Charts */}
            <div className="lg:col-span-2 space-y-6">
               <TagStats
                  endDate={dateRange.endDate}
                  startDate={dateRange.startDate}
                  tagId={tagId}
               />
               <TagCharts
                  endDate={dateRange.endDate}
                  startDate={dateRange.startDate}
                  tagId={tagId}
               />
            </div>

            {/* Full Width - Transactions */}
            <div className="lg:col-span-full">
               <TagTransactions
                  endDate={dateRange.endDate}
                  startDate={dateRange.startDate}
                  tagId={tagId}
               />
            </div>
         </div>
      </main>
   );
}

function TagPageSkeleton() {
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

function TagPageError({ error, resetErrorBoundary }: FallbackProps) {
   const { activeOrganization } = useActiveOrganization();
   const router = useRouter();
   return (
      <main className="flex flex-col h-full w-full">
         <div className="flex-1 flex items-center justify-center">
            <Empty>
               <EmptyContent>
                  <EmptyMedia variant="icon">
                     <Tag className="size-12 text-destructive" />
                  </EmptyMedia>
                  <EmptyTitle>Failed to load tag</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           router.navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/tags",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <Home className="size-4 mr-2" />
                        Go to Tags
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

export function TagDetailsPage() {
   return (
      <TransactionListProvider>
         <ErrorBoundary FallbackComponent={TagPageError}>
            <Suspense fallback={<TagPageSkeleton />}>
               <TagContent />
            </Suspense>
         </ErrorBoundary>
      </TransactionListProvider>
   );
}
