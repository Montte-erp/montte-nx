import { Button } from "@packages/ui/components/button";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQueries } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Suspense, useEffect } from "react";
import { DefaultHeader } from "@/default/default-header";
import {
   BillListProvider,
   useBillList,
} from "@/features/bill/lib/bill-list-context";
import { ManageBillForm } from "@/features/bill/ui/manage-bill-form";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { BillFilterBar } from "./bill-filter-bar";
import { BillsListSection } from "./bills-list-section";
import { BillsStats } from "./bills-stats";

type BillsSearch = {
   type?: "payable" | "receivable";
};

function BillFilterBarSkeleton() {
   return (
      <div className="space-y-3">
         <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
               {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton
                     className="h-8 w-20"
                     key={`period-skeleton-${i + 1}`}
                  />
               ))}
            </div>
            <Skeleton className="h-8 w-32" />
         </div>
         <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
               <Skeleton className="h-8 w-24" />
               <Skeleton className="h-8 w-24" />
               <Skeleton className="h-8 w-24" />
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex gap-1">
               <Skeleton className="h-8 w-20" />
               <Skeleton className="h-8 w-24" />
            </div>
            <div className="h-4 w-px bg-border" />
            <Skeleton className="h-8 w-28" />
         </div>
      </div>
   );
}

function BillFilterBarWrapper() {
   const trpc = useTRPC();
   const search = useSearch({
      from: "/$slug/_dashboard/bills/",
   }) as BillsSearch;
   const billType = search.type;

   const {
      timePeriod,
      handleTimePeriodChange,
      customDateRange,
      setCustomDateRange,
      statusFilter,
      setStatusFilter,
      typeFilter,
      setTypeFilter,
      categoryFilter,
      setCategoryFilter,
      bankAccountFilter,
      setBankAccountFilter,
      clearFilters,
      hasActiveFilters,
      pageSize,
      setPageSize,
      currentFilterType,
      setCurrentFilterType,
   } = useBillList();

   // Set current filter type based on route
   useEffect(() => {
      const newFilterType =
         billType === "payable" || billType === "receivable"
            ? billType
            : undefined;

      if (newFilterType !== currentFilterType) {
         setCurrentFilterType(newFilterType);
      }
   }, [billType, currentFilterType, setCurrentFilterType]);

   const [categoriesQuery, bankAccountsQuery] = useSuspenseQueries({
      queries: [
         trpc.categories.getAll.queryOptions(),
         trpc.bankAccounts.getAll.queryOptions(),
      ],
   });

   return (
      <BillFilterBar
         bankAccountFilter={bankAccountFilter}
         bankAccounts={bankAccountsQuery.data ?? []}
         categories={categoriesQuery.data ?? []}
         categoryFilter={categoryFilter}
         currentFilterType={billType}
         customDateRange={customDateRange}
         hasActiveFilters={hasActiveFilters}
         onBankAccountFilterChange={setBankAccountFilter}
         onCategoryFilterChange={setCategoryFilter}
         onClearFilters={clearFilters}
         onCustomDateRangeChange={setCustomDateRange}
         onPageSizeChange={setPageSize}
         onStatusFilterChange={setStatusFilter}
         onTimePeriodChange={handleTimePeriodChange}
         onTypeFilterChange={setTypeFilter}
         pageSize={pageSize}
         statusFilter={statusFilter}
         timePeriod={timePeriod}
         typeFilter={typeFilter}
      />
   );
}

function BillsPageContent() {
   const { openSheet } = useSheet();
   const search = useSearch({
      from: "/$slug/_dashboard/bills/",
   }) as BillsSearch;
   const billType = search.type;

   const getHeaderContent = () => {
      if (billType === "payable") {
         return {
            description: "Gerencie suas despesas futuras",
            title: "Contas a Pagar",
         };
      }
      if (billType === "receivable") {
         return {
            description: "Gerencie suas receitas futuras",
            title: "Contas a Receber",
         };
      }
      return {
         description: "Gerencie suas contas a pagar e a receber",
         title: "Contas a Pagar e Receber",
      };
   };

   const { title, description } = getHeaderContent();

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() =>
                     openSheet({
                        children: <ManageBillForm />,
                     })
                  }
               >
                  <Plus className="size-4" />
                  Nova Conta
               </Button>
            }
            description={description}
            title={title}
         />

         <Suspense fallback={<BillFilterBarSkeleton />}>
            <BillFilterBarWrapper />
         </Suspense>

         <BillsStats type={billType} />
         <BillsListSection type={billType} />
      </main>
   );
}

export function BillsPage() {
   return (
      <BillListProvider>
         <BillsPageContent />
      </BillListProvider>
   );
}
