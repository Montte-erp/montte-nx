import { Button } from "@packages/ui/components/button";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { DefaultHeader } from "@/default/default-header";
import {
   TransactionListProvider,
   useTransactionList,
} from "@/features/transaction/lib/transaction-list-context";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { TransactionFilterBar } from "./transaction-filter-bar";
import { TransactionsListSection } from "./transactions-list-section";
import { TransactionsStats } from "./transactions-stats";

function TransactionFilterBarSkeleton() {
   return (
      <div className="flex flex-wrap items-center gap-3">
         <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
               <Skeleton className="h-8 w-20" key={`skeleton-${i + 1}`} />
            ))}
         </div>
         <Skeleton className="h-8 w-32" />
         <div className="h-4 w-px bg-border" />
         <div className="flex gap-1">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
         </div>
      </div>
   );
}

function TransactionFilterBarWrapper() {
   const trpc = useTRPC();
   const {
      timePeriod,
      handleTimePeriodChange,
      customDateRange,
      setCustomDateRange,
      typeFilter,
      setTypeFilter,
      categoryFilter,
      setCategoryFilter,
      bankAccountFilter,
      setBankAccountFilter,
      clearFilters,
      hasActiveFilters,
   } = useTransactionList();

   const [categoriesQuery, bankAccountsQuery] = useSuspenseQueries({
      queries: [
         trpc.categories.getAll.queryOptions(),
         trpc.bankAccounts.getAll.queryOptions(),
      ],
   });

   return (
      <TransactionFilterBar
         bankAccountFilter={bankAccountFilter}
         bankAccounts={bankAccountsQuery.data ?? []}
         categories={categoriesQuery.data ?? []}
         categoryFilter={categoryFilter}
         customDateRange={customDateRange}
         hasActiveFilters={hasActiveFilters}
         onBankAccountFilterChange={setBankAccountFilter}
         onCategoryFilterChange={setCategoryFilter}
         onClearFilters={clearFilters}
         onCustomDateRangeChange={setCustomDateRange}
         onTimePeriodChange={handleTimePeriodChange}
         onTypeFilterChange={setTypeFilter}
         timePeriod={timePeriod}
         typeFilter={typeFilter}
      />
   );
}

function TransactionsPageContent() {
   const { openSheet } = useSheet();

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() =>
                     openSheet({
                        children: <ManageTransactionForm />,
                     })
                  }
               >
                  <Plus className="size-4" />
                  Adicionar Nova Transação
               </Button>
            }
            description="Veja todas as suas transações financeiras aqui."
            title="Lista de Transações"
         />

         <Suspense fallback={<TransactionFilterBarSkeleton />}>
            <TransactionFilterBarWrapper />
         </Suspense>

         <TransactionsStats />
         <TransactionsListSection />
      </main>
   );
}

export function TransactionsPage() {
   return (
      <TransactionListProvider>
         <TransactionsPageContent />
      </TransactionListProvider>
   );
}
