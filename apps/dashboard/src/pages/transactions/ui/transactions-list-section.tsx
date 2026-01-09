import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { keepPreviousData, useSuspenseQueries } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useTransactionList } from "@/features/transaction/lib/transaction-list-context";
import {
   TransactionList,
   TransactionListSkeleton,
} from "@/features/transaction/ui/transaction-list";
import { useTRPC } from "@/integrations/clients";

function TransactionsListErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardHeader>
            <CardTitle>
               Lista de Transações
            </CardTitle>
            <CardDescription>
               Veja todas as suas transações financeiras aqui.
            </CardDescription>
         </CardHeader>
         <CardContent>
            {createErrorFallback({
               errorDescription:
                  "Failed to load transactions. Please try again later.",
               errorTitle: "Error loading transactions",
               retryText: "Retry",
            })(props)}
         </CardContent>
      </Card>
   );
}

function TransactionsListContent() {
   const trpc = useTRPC();
   const [currentPage, setCurrentPage] = useState(1);
   const [searchTerm, setSearchTerm] = useState("");
   const [pageSize, setPageSize] = useState(10);

   const { categoryFilter, typeFilter, bankAccountFilter, startDate, endDate } =
      useTransactionList();

   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
         setCurrentPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm]);

   useEffect(() => {
      setCurrentPage(1);
   }, []);

   const [transactionsQuery, categoriesQuery] = useSuspenseQueries({
      queries: [
         trpc.transactions.getAllPaginated.queryOptions(
            {
               bankAccountId:
                  bankAccountFilter === "all" ? undefined : bankAccountFilter,
               categoryId:
                  categoryFilter === "all" ? undefined : categoryFilter,
               endDate: endDate?.toISOString(),
               limit: pageSize,
               page: currentPage,
               search: debouncedSearchTerm || undefined,
               startDate: startDate?.toISOString(),
               type:
                  typeFilter === "" || typeFilter === "all"
                     ? undefined
                     : (typeFilter as "income" | "expense" | "transfer"),
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

   return (
      <TransactionList
         categories={categories}
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

export function TransactionsListSection() {
   return (
      <ErrorBoundary FallbackComponent={TransactionsListErrorFallback}>
         <Suspense fallback={<TransactionListSkeleton />}>
            <TransactionsListContent />
         </Suspense>
      </ErrorBoundary>
   );
}
