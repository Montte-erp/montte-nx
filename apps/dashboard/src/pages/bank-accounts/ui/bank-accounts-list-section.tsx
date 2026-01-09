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
import { Building, Check, Search, Trash2, X } from "lucide-react";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";
import { useBankAccountBulkActions } from "../features/use-bank-account-bulk-actions";
import {
   BankAccountExpandedContent,
   BankAccountMobileCard,
   createBankAccountColumns,
} from "./bank-accounts-table-columns";

function BankAccountsListErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription:
                  "Failed to load bank accounts. Please try again later.",
               errorTitle: "Error loading bank accounts",
               retryText: "Retry",
            })(props)}
         </CardContent>
      </Card>
   );
}

function BankAccountsListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <Skeleton className="h-9 w-full sm:max-w-md" />
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`bank-account-skeleton-${index + 1}`}>
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

type BankAccountsListContentProps = {
   statusFilter: string;
   typeFilter: string;
};

function BankAccountsListContent({
   statusFilter,
   typeFilter,
}: BankAccountsListContentProps) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();
   const [currentPage, setCurrentPage] = useState(1);
   const [searchTerm, setSearchTerm] = useState("");
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
   const [pageSize, setPageSize] = useState(10);

   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
         setCurrentPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm]);
   //TODO: achar uma forma melhor de fazer isso
   // biome-ignore lint/correctness/useExhaustiveDependencies: Reset page when filters change
   useEffect(() => {
      setCurrentPage(1);
   }, [statusFilter, typeFilter, pageSize]);

   const { data: paginatedData } = useSuspenseQuery(
      trpc.bankAccounts.getAllPaginated.queryOptions(
         {
            limit: pageSize,
            page: currentPage,
            search: debouncedSearchTerm || undefined,
            status: statusFilter
               ? (statusFilter as "active" | "inactive")
               : undefined,
            type: typeFilter
               ? (typeFilter as "checking" | "savings" | "investment")
               : undefined,
         },
         {
            placeholderData: keepPreviousData,
         },
      ),
   );

   const { data: balances } = useSuspenseQuery(
      trpc.bankAccounts.getBalances.queryOptions(),
   );

   const accountStatsMap = useMemo(() => {
      const map: Record<
         string,
         { balance: number; income: number; expenses: number }
      > = {};
      for (const item of balances) {
         map[item.id] = {
            balance: item.balance,
            expenses: item.expenses,
            income: item.income,
         };
      }
      return map;
   }, [balances]);

   const { bankAccounts, pagination } = paginatedData;
   const { totalPages, totalCount } = pagination;

   const hasActiveFilters = debouncedSearchTerm || statusFilter || typeFilter;

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );
   const selectedAccounts = bankAccounts.filter((account) =>
      selectedIds.includes(account.id),
   );
   const selectedBalance = selectedAccounts.reduce((sum, account) => {
      const stats = accountStatsMap[account.id];
      return sum + (stats?.balance || 0);
   }, 0);

   const {
      allBankAccounts,
      canDelete,
      markAsActive,
      markAsInactive,
      deleteSelected,
      isLoading,
   } = useBankAccountBulkActions({
      onSuccess: () => setRowSelection({}),
   });

   const handleClearSelection = () => {
      setRowSelection({});
   };

   return (
      <>
         <Card>
            <CardContent className="pt-6 grid gap-4">
               <InputGroup className="sm:max-w-md">
                  <InputGroupInput
                     onChange={(e) => setSearchTerm(e.target.value)}
                     placeholder="Buscar..."
                     value={searchTerm}
                  />
                  <InputGroupAddon>
                     <Search />
                  </InputGroupAddon>
               </InputGroup>

               {bankAccounts.length === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Building className="size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyTitle>
                           {hasActiveFilters
                              ? "Nenhuma conta encontrada"
                              : "Nenhuma conta encontrada"}
                        </EmptyTitle>
                        <EmptyDescription>
                           {hasActiveFilters
                              ? "Nenhuma conta encontrada com os filtros aplicados"
                              : "Cadastre sua primeira conta bancária para começar."}
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createBankAccountColumns()}
                     data={bankAccounts}
                     enableRowSelection
                     getRowId={(row) => row.id}
                     onRowSelectionChange={setRowSelection}
                     pagination={{
                        currentPage,
                        onPageChange: setCurrentPage,
                        onPageSizeChange: setPageSize,
                        pageSize,
                        totalCount,
                        totalPages,
                     }}
                     renderMobileCard={(props) => {
                        const stats = accountStatsMap[
                           props.row.original.id
                        ] ?? {
                           balance: 0,
                           expenses: 0,
                           income: 0,
                        };
                        return (
                           <BankAccountMobileCard
                              {...props}
                              balance={stats.balance}
                              expenses={stats.expenses}
                              income={stats.income}
                           />
                        );
                     }}
                     renderSubComponent={(props) => {
                        const stats = accountStatsMap[
                           props.row.original.id
                        ] ?? {
                           balance: 0,
                           expenses: 0,
                           income: 0,
                        };
                        return (
                           <BankAccountExpandedContent
                              {...props}
                              balance={stats.balance}
                              expenses={stats.expenses}
                              income={stats.income}
                           />
                        );
                     }}
                     rowSelection={rowSelection}
                  />
               )}
            </CardContent>
         </Card>

         <SelectionActionBar
            onClear={handleClearSelection}
            selectedCount={selectedIds.length}
            summary={formatDecimalCurrency(selectedBalance)}
         >
            <SelectionActionButton
               disabled={isLoading}
               icon={<Check className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Confirmar",
                     cancelLabel: "Cancelar",
                     description: `Tem certeza que deseja ativar ${selectedIds.length} conta(s)?`,
                     onAction: () => markAsActive(selectedIds),
                     title: `Ativar ${selectedIds.length} conta(s)`,
                  })
               }
            >
               Ativar
            </SelectionActionButton>
            <SelectionActionButton
               disabled={isLoading}
               icon={<X className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Confirmar",
                     cancelLabel: "Cancelar",
                     description: `Tem certeza que deseja desativar ${selectedIds.length} conta(s)?`,
                     onAction: () => markAsInactive(selectedIds),
                     title: `Desativar ${selectedIds.length} conta(s)`,
                  })
               }
            >
               Desativar
            </SelectionActionButton>
            <SelectionActionButton
               disabled={
                  isLoading ||
                  !canDelete ||
                  selectedIds.length === 0 ||
                  selectedIds.length >= allBankAccounts.length
               }
               icon={<Trash2 className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Excluir",
                     cancelLabel: "Cancelar",
                     description: `Tem certeza que deseja excluir ${selectedIds.length} conta(s)? Esta ação não pode ser desfeita.`,
                     onAction: () => deleteSelected(selectedIds),
                     title: `Excluir ${selectedIds.length} conta(s)`,
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

type BankAccountsListSectionProps = {
   statusFilter: string;
   typeFilter: string;
};

export function BankAccountsListSection({
   statusFilter,
   typeFilter,
}: BankAccountsListSectionProps) {
   return (
      <ErrorBoundary FallbackComponent={BankAccountsListErrorFallback}>
         <Suspense fallback={<BankAccountsListSkeleton />}>
            <BankAccountsListContent
               statusFilter={statusFilter}
               typeFilter={typeFilter}
            />
         </Suspense>
      </ErrorBoundary>
   );
}
