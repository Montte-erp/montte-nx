import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import { useRowSelection } from "@packages/ui/hooks/use-row-selection";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
   ArrowLeftRight,
   FolderOpen,
   Hash,
   Landmark,
   MoreHorizontal,
   Pencil,
   Repeat,
   Scale,
   Trash2,
   TrendingDown,
   TrendingUp,
} from "lucide-react";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import type {
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { useCallback } from "react";
import { toast } from "sonner";
import { BillFromTransactionDialogStack } from "@/features/bills/ui/bill-from-transaction-dialog-stack";
import { BulkCategorizeForm } from "@/features/transactions/ui/bulk-categorize-form";
import { BulkMoveAccountForm } from "@/features/transactions/ui/bulk-move-account-form";
import { TransactionDialogStack } from "@/features/transactions/ui/transaction-dialog-stack";
import type { TransactionFilters } from "@/features/transactions/ui/transaction-filter-bar";
import {
   buildTransactionColumns,
   formatBRL,
   type TransactionRow,
} from "@/features/transactions/ui/transactions-columns";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDialogStack } from "@/hooks/use-dialog-stack";
import { orpc } from "@/integrations/orpc/client";

const [useTransactionsTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:transactions",
      null,
   );

interface TransactionsListProps {
   filters: TransactionFilters;
   onPageChange: (page: number) => void;
   onPageSizeChange: (size: number) => void;
   sorting: SortingState;
   onSortingChange: OnChangeFn<SortingState>;
   columnFilters: ColumnFiltersState;
   onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
}

export function TransactionsList({
   filters,
   onPageChange,
   onPageSizeChange,
   sorting,
   onSortingChange,
   columnFilters,
   onColumnFiltersChange,
}: TransactionsListProps) {
   const [tableState, setTableState] = useTransactionsTableState();

   const { openDialogStack, closeDialogStack } = useDialogStack();
   const { openAlertDialog } = useAlertDialog();
   const {
      rowSelection,
      onRowSelectionChange,
      selectedCount,
      selectedIds,
      onClear,
   } = useRowSelection();

   const { data: result } = useSuspenseQuery(
      orpc.transactions.getAll.queryOptions({
         input: {
            type: filters.type,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            search: filters.search || undefined,
            conditionGroup: filters.conditionGroup,
            bankAccountId: filters.bankAccountId,
            creditCardId: filters.creditCardId,
            paymentMethod: filters.paymentMethod,
            categoryId: filters.categoryId,
            page: filters.page,
            pageSize: filters.pageSize,
         },
      }),
   );

   const { data: summary } = useSuspenseQuery(
      orpc.transactions.getSummary.queryOptions({
         input: {
            type: filters.type,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            search: filters.search || undefined,
            conditionGroup: filters.conditionGroup,
            bankAccountId: filters.bankAccountId,
            creditCardId: filters.creditCardId,
            paymentMethod: filters.paymentMethod,
            categoryId: filters.categoryId,
         },
      }),
   );

   const transactionData = result.data;
   const totalPages = Math.ceil(result.total / filters.pageSize);

   const deleteMutation = useMutation(
      orpc.transactions.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Lançamento excluído com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir lançamento.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar lançamentos.");
         },
      }),
   );

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const handleEdit = useCallback(
      (transaction: TransactionRow) => {
         openDialogStack({
            children: (
               <TransactionDialogStack
                  mode="edit"
                  onSuccess={closeDialogStack}
                  transaction={transaction}
               />
            ),
         });
      },
      [openDialogStack, closeDialogStack],
   );

   const handleDelete = useCallback(
      (transaction: TransactionRow) => {
         openAlertDialog({
            title: "Excluir lançamento",
            description:
               "Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: transaction.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const handleRecurring = useCallback(
      (tx: TransactionRow) => {
         openDialogStack({
            children: (
               <BillFromTransactionDialogStack
                  bankAccountId={tx.bankAccountId}
                  categoryId={tx.categoryId}
                  mode="recurring"
                  onSuccess={closeDialogStack}
                  transactionAmount={tx.amount}
                  transactionDate={tx.date}
                  transactionId={tx.id}
                  transactionName={tx.name ?? ""}
                  transactionType={tx.type}
               />
            ),
         });
      },
      [openDialogStack, closeDialogStack],
   );

   const handleBulkDelete = useCallback(() => {
      openAlertDialog({
         title: `Excluir ${selectedCount} ${selectedCount === 1 ? "lançamento" : "lançamentos"}`,
         description:
            "Tem certeza que deseja excluir os lançamentos selecionados? Esta ação não pode ser desfeita.",
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await Promise.all(
               selectedIds.map((id) => deleteMutation.mutateAsync({ id })),
            );
            onClear();
         },
      });
   }, [openAlertDialog, selectedCount, selectedIds, deleteMutation, onClear]);

   const handleBulkCategorize = useCallback(() => {
      openDialogStack({
         children: (
            <BulkCategorizeForm
               onApply={async (categoryId) => {
                  await Promise.all(
                     selectedIds.map((id) =>
                        updateMutation.mutateAsync({ id, categoryId }),
                     ),
                  );
                  onClear();
                  closeDialogStack();
                  toast.success(
                     `${selectedCount} ${selectedCount === 1 ? "lançamento categorizado" : "lançamentos categorizados"}.`,
                  );
               }}
               onCancel={closeDialogStack}
               selectedCount={selectedCount}
            />
         ),
      });
   }, [
      openDialogStack,
      closeDialogStack,
      selectedCount,
      selectedIds,
      updateMutation,
      onClear,
   ]);

   const handleBulkMoveAccount = useCallback(() => {
      openDialogStack({
         children: (
            <BulkMoveAccountForm
               bankAccounts={bankAccounts}
               onApply={async (bankAccountId, destinationBankAccountId) => {
                  await Promise.all(
                     selectedIds.map((id) =>
                        updateMutation.mutateAsync({
                           id,
                           bankAccountId,
                           destinationBankAccountId,
                        }),
                     ),
                  );
                  onClear();
                  closeDialogStack();
                  toast.success(
                     `${selectedCount} ${selectedCount === 1 ? "lançamento convertido" : "lançamentos convertidos"} em transferências.`,
                  );
               }}
               onCancel={closeDialogStack}
               selectedCount={selectedCount}
            />
         ),
      });
   }, [
      openDialogStack,
      closeDialogStack,
      bankAccounts,
      selectedCount,
      selectedIds,
      updateMutation,
      onClear,
   ]);

   const columns = buildTransactionColumns();

   if (transactionData.length === 0 && filters.page === 1) {
      return (
         <div className="flex flex-col gap-4">
            <SummaryBar summary={summary} />
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <ArrowLeftRight className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum lançamento</EmptyTitle>
                  <EmptyDescription>
                     {filters.search ||
                     filters.type ||
                     filters.dateFrom ||
                     (filters.conditionGroup?.conditions.length ?? 0) > 0
                        ? "Nenhum lançamento encontrado para os filtros aplicados."
                        : "Registre um novo lançamento para começar a controlar suas finanças."}
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </div>
      );
   }

   return (
      <>
         <SummaryBar summary={summary} />
         <DataTable
            columns={columns}
            columnFilters={columnFilters}
            data={transactionData}
            getRowId={(row) => row.id}
            onColumnFiltersChange={onColumnFiltersChange}
            onRowSelectionChange={onRowSelectionChange}
            onSortingChange={onSortingChange}
            onTableStateChange={setTableState}
            sorting={sorting}
            tableState={tableState}
            pagination={{
               currentPage: filters.page,
               onPageChange,
               onPageSizeChange,
               pageSize: filters.pageSize,
               totalCount: result.total,
               totalPages,
            }}
            renderActions={({ row }) => {
               const tx = row.original;
               const isTransfer = tx.type === "transfer";
               return (
                  <>
                     <Button
                        onClick={() => handleEdit(tx)}
                        tooltip="Editar"
                        variant="outline"
                     >
                        <Pencil className="size-4" />
                     </Button>
                     <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(tx)}
                        tooltip="Excluir"
                        variant="outline"
                     >
                        <Trash2 className="size-4" />
                     </Button>
                     {!isTransfer && (
                        <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                              <Button variant="outline">
                                 <MoreHorizontal className="size-4" />
                                 <span className="sr-only">Mais ações</span>
                              </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Mais ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                 onClick={() => handleRecurring(tx)}
                              >
                                 <Repeat className="size-4" />
                                 Criar Lançamento Recorrente
                              </DropdownMenuItem>
                           </DropdownMenuContent>
                        </DropdownMenu>
                     )}
                  </>
               );
            }}
            rowSelection={rowSelection}
         />
         <SelectionActionBar onClear={onClear} selectedCount={selectedCount}>
            <SelectionActionButton
               icon={<FolderOpen className="size-3.5" />}
               onClick={handleBulkCategorize}
            >
               Categorizar
            </SelectionActionButton>
            <SelectionActionButton
               icon={<Landmark className="size-3.5" />}
               onClick={handleBulkMoveAccount}
            >
               Mover conta
            </SelectionActionButton>
            <SelectionActionButton
               icon={<Trash2 className="size-3.5" />}
               onClick={handleBulkDelete}
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}

function SummaryBar({
   summary,
}: {
   summary: {
      totalCount: number;
      incomeTotal: string;
      expenseTotal: string;
      balance: string;
   };
}) {
   return (
      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-card px-4 py-2.5 sm:flex sm:items-center">
         <Announcement>
            <AnnouncementTag className="flex items-center gap-2">
               <TrendingDown className="size-4 text-destructive" />
               Saídas
            </AnnouncementTag>
            <AnnouncementTitle>
               <span className="tabular-nums font-semibold text-destructive">
                  {formatBRL(summary.expenseTotal)}
               </span>
            </AnnouncementTitle>
         </Announcement>
         <Announcement>
            <AnnouncementTag className="flex items-center gap-2">
               <TrendingUp className="size-4 text-green-600 dark:text-green-500" />
               Entradas
            </AnnouncementTag>
            <AnnouncementTitle>
               <span className="tabular-nums font-semibold text-green-600 dark:text-green-500">
                  {formatBRL(summary.incomeTotal)}
               </span>
            </AnnouncementTitle>
         </Announcement>
         <Announcement>
            <AnnouncementTag className="flex items-center gap-2">
               <Hash className="size-4 text-muted-foreground" />
               Lançamentos
            </AnnouncementTag>
            <AnnouncementTitle>
               <span className="tabular-nums font-semibold">
                  {summary.totalCount}
               </span>
            </AnnouncementTitle>
         </Announcement>
         <Announcement>
            <AnnouncementTag className="flex items-center gap-2">
               <Scale className="size-4 text-muted-foreground" />
               Saldo
            </AnnouncementTag>
            <AnnouncementTitle>
               <span
                  className={`tabular-nums font-semibold ${Number(summary.balance) >= 0 ? "text-green-600 dark:text-green-500" : "text-destructive"}`}
               >
                  {formatBRL(summary.balance)}
               </span>
            </AnnouncementTitle>
         </Announcement>
      </div>
   );
}
