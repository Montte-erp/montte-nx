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
import { Fragment, Suspense, useEffect, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { TransactionList } from "@/features/transaction/ui/transaction-list";
import { useTRPC } from "@/integrations/clients";

type Goal = RouterOutput["goals"]["getById"];

type GoalTransactionsSectionProps = {
   goal: Goal;
};

function GoalTransactionsSkeleton() {
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
                  <Fragment key={`goal-transaction-skeleton-${index + 1}`}>
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

function GoalTransactionsErrorFallback({ error }: FallbackProps) {
   return (
      <Card>
         <CardHeader>
            <CardTitle>Transacoes da Meta</CardTitle>
         </CardHeader>
         <CardContent>
            <Empty>
               <EmptyContent>
                  <EmptyMedia variant="icon">
                     <Receipt className="size-12 text-destructive" />
                  </EmptyMedia>
                  <EmptyTitle>Erro ao carregar transacoes</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
               </EmptyContent>
            </Empty>
         </CardContent>
      </Card>
   );
}

function GoalTransactionsContent({ goal }: GoalTransactionsSectionProps) {
   const trpc = useTRPC();
   const [currentPage, setCurrentPage] = useState(1);
   const [pageSize, setPageSize] = useState(10);
   const [searchTerm, setSearchTerm] = useState("");
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
         setCurrentPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm]);

   const tagId = goal.tagId;

   const [transactionsQuery, categoriesQuery] = useSuspenseQueries({
      queries: [
         trpc.transactions.getAllPaginated.queryOptions(
            {
               limit: pageSize,
               page: currentPage,
               search: debouncedSearchTerm || undefined,
               tagId,
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
               <CardTitle>Transacoes da Meta</CardTitle>
               <CardDescription>
                  Transacoes vinculadas a esta meta atraves da tag
               </CardDescription>
            </CardHeader>
            <CardContent>
               <Empty>
                  <EmptyContent>
                     <EmptyMedia variant="icon">
                        <Receipt className="size-12 text-muted-foreground" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhuma transacao encontrada</EmptyTitle>
                     <EmptyDescription>
                        Adicione transacoes com a tag "{goal.tag.name}" para que
                        elas aparecam aqui e contribuam para o progresso da meta.
                     </EmptyDescription>
                  </EmptyContent>
               </Empty>
            </CardContent>
         </Card>
      );
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle>Transacoes da Meta</CardTitle>
            <CardDescription>
               Transacoes vinculadas a esta meta atraves da tag "{goal.tag.name}"
            </CardDescription>
         </CardHeader>
         <CardContent>
            <TransactionList
               categories={categories}
               emptyStateDescription={`Adicione transacoes com a tag "${goal.tag.name}" para contribuir para a meta`}
               emptyStateTitle="Nenhuma transacao encontrada"
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
         </CardContent>
      </Card>
   );
}

export function GoalTransactionsSection(props: GoalTransactionsSectionProps) {
   return (
      <ErrorBoundary FallbackComponent={GoalTransactionsErrorFallback}>
         <Suspense fallback={<GoalTransactionsSkeleton />}>
            <GoalTransactionsContent {...props} />
         </Suspense>
      </ErrorBoundary>
   );
}
