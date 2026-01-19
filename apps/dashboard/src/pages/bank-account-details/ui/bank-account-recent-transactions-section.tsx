import { formatDecimalCurrency } from "@packages/money";
import { Card, CardContent } from "@packages/ui/components/card";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import { ItemGroup, ItemSeparator } from "@packages/ui/components/item";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import { Skeleton } from "@packages/ui/components/skeleton";
import { keepPreviousData, useSuspenseQuery } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";
import {
   ArrowLeftRight,
   FolderOpen,
   Search,
   Trash2,
   Wallet,
} from "lucide-react";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useTransactionBulkActions } from "@/features/transaction/lib/use-transaction-bulk-actions";
import { CategorizeForm } from "@/features/transaction/ui/categorize-form";
import { MarkAsTransferForm } from "@/features/transaction/ui/mark-as-transfer-form";
import { TransactionExpandedContent } from "@/features/transaction/ui/transaction-expanded-content";
import { TransactionMobileCard } from "@/features/transaction/ui/transaction-mobile-card";
import { createTransactionColumns } from "@/features/transaction/ui/transaction-table-columns";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

function RecentTransactionsErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription:
                  "Falha ao carregar transações. Tente novamente mais tarde.",
               errorTitle: "Erro ao carregar transações",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function RecentTransactionsSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
               <Skeleton className="h-9 flex-1 sm:max-w-md" />
            </div>
            <div className="flex gap-2">
               <Skeleton className="h-8 w-24" />
               <Skeleton className="h-8 w-24" />
               <Skeleton className="h-8 w-28" />
            </div>
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`transaction-skeleton-${index + 1}`}>
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
            <div className="flex items-center justify-end gap-2 pt-4">
               <Skeleton className="h-10 w-24" />
               <Skeleton className="h-10 w-10" />
               <Skeleton className="h-10 w-24" />
            </div>
         </CardContent>
      </Card>
   );
}

function RecentTransactionsContent({
   bankAccountId,
   startDate,
   endDate,
   typeFilter = "",
   categoryFilter = "all",
}: {
   bankAccountId: string;
   startDate: Date | null;
   endDate: Date | null;
   typeFilter?: string;
   categoryFilter?: string;
}) {
   const trpc = useTRPC();
   const { activeOrganization } = useActiveOrganization();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const [currentPage, setCurrentPage] = useState(1);
   const pageSize = 10;
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const [searchTerm, setSearchTerm] = useState("");
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
         setCurrentPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm]);

   // biome-ignore lint/correctness/useExhaustiveDependencies: Reset page when filters change
   useEffect(() => {
      setCurrentPage(1);
   }, [typeFilter, categoryFilter, startDate, endDate]);

   const { data } = useSuspenseQuery(
      trpc.bankAccounts.getTransactions.queryOptions(
         {
            categoryId: categoryFilter === "all" ? undefined : categoryFilter,
            endDate: endDate?.toISOString(),
            id: bankAccountId,
            limit: pageSize,
            page: currentPage,
            search: debouncedSearchTerm || undefined,
            startDate: startDate?.toISOString(),
            type:
               typeFilter === ""
                  ? undefined
                  : (typeFilter as "income" | "expense" | "transfer"),
         },
         {
            placeholderData: keepPreviousData,
         },
      ),
   );

   const { transactions, pagination } = data;
   const { totalPages, totalCount } = pagination;

   const { data: categories = [] } = useSuspenseQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const { deleteSelected } = useTransactionBulkActions({
      bankAccountId,
      onSuccess: () => {
         setRowSelection({});
      },
   });

   const hasSearchFilter = Boolean(debouncedSearchTerm);
   const hasActiveFilters =
      hasSearchFilter || typeFilter !== "" || categoryFilter !== "all";

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );
   const selectedTransactions = transactions.filter((t) =>
      selectedIds.includes(t.id),
   );
   const selectedTotal = useMemo(() => {
      return selectedTransactions.reduce((sum, t) => {
         const amount = Number.parseFloat(t.amount);
         return t.type === "expense" ? sum - amount : sum + amount;
      }, 0);
   }, [selectedTransactions]);

   const handleClearSelection = () => {
      setRowSelection({});
   };

   const handleBulkChangeCategory = () => {
      openSheet({
         children: (
            <CategorizeForm
               onSuccess={() => setRowSelection({})}
               transactions={selectedTransactions}
            />
         ),
      });
   };

   const handleBulkTransfer = () => {
      openSheet({
         children: (
            <MarkAsTransferForm
               onSuccess={() => setRowSelection({})}
               transactions={selectedTransactions}
            />
         ),
      });
   };

   if (transactions.length === 0 && !hasActiveFilters) {
      return (
         <Card>
            <CardContent className="pt-6">
               <Empty>
                  <EmptyContent>
                     <EmptyMedia variant="icon">
                        <Wallet className="size-12 text-muted-foreground" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhuma Transação Encontrada</EmptyTitle>
                     <EmptyDescription>
                        Tente ajustar seus filtros ou adicionar uma nova
                        transação.
                     </EmptyDescription>
                  </EmptyContent>
               </Empty>
            </CardContent>
         </Card>
      );
   }

   return (
      <>
         <Card>
            <CardContent className="space-y-4">
               <InputGroup className="max-w-md">
                  <InputGroupInput
                     onChange={(e) => setSearchTerm(e.target.value)}
                     placeholder="Digite para pesquisar"
                     value={searchTerm}
                  />
                  <InputGroupAddon>
                     <Search />
                  </InputGroupAddon>
               </InputGroup>

               {transactions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                     Nenhuma Transação Encontrada
                  </div>
               ) : (
                  <DataTable
                     columns={createTransactionColumns(
                        categories,
                        activeOrganization.slug,
                     )}
                     data={transactions}
                     enableRowSelection
                     getRowId={(row) => row.id}
                     onRowSelectionChange={setRowSelection}
                     pagination={{
                        currentPage,
                        onPageChange: setCurrentPage,
                        pageSize,
                        totalCount,
                        totalPages,
                     }}
                     renderMobileCard={(props) => (
                        <TransactionMobileCard
                           {...props}
                           categories={categories}
                        />
                     )}
                     renderSubComponent={(props) => (
                        <TransactionExpandedContent
                           {...props}
                           categories={categories}
                           slug={activeOrganization.slug}
                        />
                     )}
                     rowSelection={rowSelection}
                  />
               )}
            </CardContent>
         </Card>

         <SelectionActionBar
            onClear={handleClearSelection}
            selectedCount={selectedIds.length}
            summary={formatDecimalCurrency(Math.abs(selectedTotal))}
         >
            <SelectionActionButton
               icon={<ArrowLeftRight className="size-3.5" />}
               onClick={handleBulkTransfer}
            >
               Transferência
            </SelectionActionButton>
            <SelectionActionButton
               icon={<FolderOpen className="size-3.5" />}
               onClick={handleBulkChangeCategory}
            >
               Categorizar
            </SelectionActionButton>
            <SelectionActionButton
               icon={<Trash2 className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Excluir transação",
                     cancelLabel: "Cancelar",
                     description: `Tem certeza que deseja excluir ${selectedIds.length} itens? Esta ação não pode ser desfeita.`,
                     onAction: () => deleteSelected(selectedIds),
                     title: "Confirmar Exclusão",
                     variant: "destructive",
                  })
               }
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}

export function RecentTransactions({
   bankAccountId,
   startDate,
   endDate,
   typeFilter,
   categoryFilter,
}: {
   bankAccountId: string;
   startDate: Date | null;
   endDate: Date | null;
   typeFilter?: string;
   categoryFilter?: string;
}) {
   return (
      <ErrorBoundary FallbackComponent={RecentTransactionsErrorFallback}>
         <Suspense fallback={<RecentTransactionsSkeleton />}>
            <RecentTransactionsContent
               bankAccountId={bankAccountId}
               categoryFilter={categoryFilter}
               endDate={endDate}
               startDate={startDate}
               typeFilter={typeFilter}
            />
         </Suspense>
      </ErrorBoundary>
   );
}
