import type { RouterOutput } from "@packages/api/client";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { ItemGroup, ItemSeparator } from "@packages/ui/components/item";
import { Skeleton } from "@packages/ui/components/skeleton";
import { keepPreviousData, useSuspenseQueries } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { TransactionList } from "@/features/transaction/ui/transaction-list";
import { useTRPC } from "@/integrations/clients";

type Budget = RouterOutput["budgets"]["getById"];

type BudgetTransactionsSectionProps = {
   budget: Budget;
   startDate: Date | null;
   endDate: Date | null;
};

function BudgetTransactionsSkeleton() {
   return (
      <Card>
         <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
         </CardHeader>
         <CardContent className="grid gap-4">
            <Skeleton className="h-9 max-w-md" />
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`budget-transaction-skeleton-${index + 1}`}>
                     <div className="flex items-center p-4 gap-4">
                        <Skeleton className="size-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                           <Skeleton className="h-4 w-32" />
                           <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-4 w-20" />
                     </div>
                     {index !== 4 && <ItemSeparator />}
                  </Fragment>
               ))}
            </ItemGroup>
         </CardContent>
      </Card>
   );
}

function BudgetTransactionsErrorFallback({ error }: FallbackProps) {
   return (
      <Card>
         <CardHeader>
            <CardTitle>Transações do Orçamento</CardTitle>
         </CardHeader>
         <CardContent>
            <Empty>
               <EmptyContent>
                  <EmptyMedia variant="icon">
                     <Receipt className="size-12 text-destructive" />
                  </EmptyMedia>
                  <EmptyTitle>Erro ao carregar transações</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
               </EmptyContent>
            </Empty>
         </CardContent>
      </Card>
   );
}

function BudgetTransactionsContent({
   budget,
   startDate,
   endDate,
}: BudgetTransactionsSectionProps) {
   const trpc = useTRPC();
   const [currentPage, setCurrentPage] = useState(1);
   const [pageSize, setPageSize] = useState(10);
   const [searchTerm, setSearchTerm] = useState("");
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

   const dateKey = useMemo(
      () => `${startDate?.getTime()}-${endDate?.getTime()}`,
      [startDate, endDate],
   );

   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
         setCurrentPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm]);

   // biome-ignore lint/correctness/useExhaustiveDependencies: Reset page when dates change
   useEffect(() => {
      setCurrentPage(1);
   }, [dateKey]);

   // Use the budget's tagId for filtering transactions
   const tagId = budget.tagId;

   // Get linked category IDs from budget metadata for filtering
   const linkedCategoryIds =
      (budget.metadata as { linkedCategoryIds?: string[] })
         ?.linkedCategoryIds ?? [];

   const [transactionsQuery, categoriesQuery] = useSuspenseQueries({
      queries: [
         trpc.transactions.getAllPaginated.queryOptions(
            {
               categoryIds:
                  linkedCategoryIds.length > 0 ? linkedCategoryIds : undefined,
               endDate: endDate?.toISOString(),
               limit: pageSize,
               page: currentPage,
               search: debouncedSearchTerm || undefined,
               startDate: startDate?.toISOString(),
               tagId,
               type: "expense",
            },
            {
               placeholderData: keepPreviousData,
            },
         ),
         trpc.categories.getAll.queryOptions(),
      ],
   });

   const { transactions, pagination } = transactionsQuery.data;
   const { totalPages, totalCount } = pagination;
   const categories = categoriesQuery.data ?? [];

   const hasActiveFilters = debouncedSearchTerm.length > 0;

   if (transactions.length === 0 && !hasActiveFilters) {
      return (
         <Card>
            <CardHeader>
               <CardTitle>Transações do Orçamento</CardTitle>
               <CardDescription>
                  Transações que afetam este orçamento no período selecionado
               </CardDescription>
            </CardHeader>
            <CardContent>
               <Empty>
                  <EmptyContent>
                     <EmptyMedia variant="icon">
                        <Receipt className="size-12 text-muted-foreground" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhuma transação encontrada</EmptyTitle>
                     <EmptyDescription>
                        Não há transações que afetam este orçamento no período
                        selecionado
                     </EmptyDescription>
                  </EmptyContent>
               </Empty>
            </CardContent>
         </Card>
      );
   }

   return (
      <TransactionList
         categories={categories}
         emptyStateDescription="Não há transações que afetam este orçamento no período selecionado"
         emptyStateTitle="Nenhuma transação encontrada"
         filters={{
            onSearchChange: setSearchTerm,
            searchTerm,
         }}
         pagination={{
            currentPage,
            onPageChange: setCurrentPage,
            onPageSizeChange: (size) => {
               setPageSize(size);
               setCurrentPage(1);
            },
            pageSize,
            totalCount,
            totalPages,
         }}
         transactions={transactions}
      />
   );
}

export function BudgetTransactionsSection(
   props: BudgetTransactionsSectionProps,
) {
   return (
      <ErrorBoundary FallbackComponent={BudgetTransactionsErrorFallback}>
         <Suspense fallback={<BudgetTransactionsSkeleton />}>
            <BudgetTransactionsContent {...props} />
         </Suspense>
      </ErrorBoundary>
   );
}
