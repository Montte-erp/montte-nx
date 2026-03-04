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
   CalendarDays,
   FolderOpen,
   Landmark,
   MoreHorizontal,
   Pencil,
   Repeat,
   Trash2,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { BillFromTransactionCredenza } from "@/features/bills/ui/bill-from-transaction-credenza";
import { BulkCategorizeForm } from "@/features/transactions/ui/bulk-categorize-form";
import { BulkMoveAccountForm } from "@/features/transactions/ui/bulk-move-account-form";
import type { TransactionFilters } from "@/features/transactions/ui/transaction-filter-bar";
import {
   buildTransactionColumns,
   type TransactionRow,
} from "@/features/transactions/ui/transactions-columns";
import { TransactionSheet } from "@/features/transactions/ui/transactions-sheet";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

interface TransactionsListProps {
   filters: TransactionFilters;
   onPageChange: (page: number) => void;
   onPageSizeChange: (size: number) => void;
   view: "table" | "card";
}

export function TransactionsList({
   filters,
   onPageChange,
   onPageSizeChange,
   view,
}: TransactionsListProps) {
   const { openCredenza, closeCredenza } = useCredenza();
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
            page: filters.page,
            pageSize: filters.pageSize,
         },
      }),
   );

   const transactionData = result.data as TransactionRow[];
   const totalPages = Math.ceil(result.total / filters.pageSize);

   const deleteMutation = useMutation(
      orpc.transactions.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Transação excluída com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir transação.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar transações.");
         },
      }),
   );

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const handleEdit = useCallback(
      (transaction: TransactionRow) => {
         openCredenza({
            children: (
               <TransactionSheet
                  mode="edit"
                  onSuccess={closeCredenza}
                  transaction={transaction}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (transaction: TransactionRow) => {
         openAlertDialog({
            title: "Excluir transação",
            description:
               "Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.",
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

   const handleInstallment = useCallback(
      (tx: TransactionRow) => {
         openCredenza({
            children: (
               <BillFromTransactionCredenza
                  bankAccountId={tx.bankAccountId}
                  categoryId={tx.categoryId}
                  mode="installment"
                  onSuccess={closeCredenza}
                  transactionAmount={tx.amount}
                  transactionDate={tx.date}
                  transactionId={tx.id}
                  transactionName={tx.name ?? ""}
                  transactionType={tx.type}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleRecurring = useCallback(
      (tx: TransactionRow) => {
         openCredenza({
            children: (
               <BillFromTransactionCredenza
                  bankAccountId={tx.bankAccountId}
                  categoryId={tx.categoryId}
                  mode="recurring"
                  onSuccess={closeCredenza}
                  transactionAmount={tx.amount}
                  transactionDate={tx.date}
                  transactionId={tx.id}
                  transactionName={tx.name ?? ""}
                  transactionType={tx.type}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleBulkDelete = useCallback(() => {
      openAlertDialog({
         title: `Excluir ${selectedCount} ${selectedCount === 1 ? "transação" : "transações"}`,
         description:
            "Tem certeza que deseja excluir as transações selecionadas? Esta ação não pode ser desfeita.",
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
      openCredenza({
         children: (
            <BulkCategorizeForm
               onApply={async (categoryId) => {
                  await Promise.all(
                     selectedIds.map((id) =>
                        updateMutation.mutateAsync({ id, categoryId }),
                     ),
                  );
                  onClear();
                  closeCredenza();
                  toast.success(
                     `${selectedCount} ${selectedCount === 1 ? "transação categorizada" : "transações categorizadas"}.`,
                  );
               }}
               onCancel={closeCredenza}
               selectedCount={selectedCount}
            />
         ),
      });
   }, [
      openCredenza,
      closeCredenza,
      selectedCount,
      selectedIds,
      updateMutation,
      onClear,
   ]);

   const handleBulkMoveAccount = useCallback(() => {
      openCredenza({
         children: (
            <BulkMoveAccountForm
               bankAccounts={bankAccounts}
               onApply={async (bankAccountId, destinationBankAccountId) => {
                  await Promise.all(
                     selectedIds.map((id) =>
                        updateMutation.mutateAsync({
                           id,
                           type: "transfer",
                           bankAccountId,
                           destinationBankAccountId,
                        }),
                     ),
                  );
                  onClear();
                  closeCredenza();
                  toast.success(
                     `${selectedCount} ${selectedCount === 1 ? "transação convertida" : "transações convertidas"} em transferências.`,
                  );
               }}
               onCancel={closeCredenza}
               selectedCount={selectedCount}
            />
         ),
      });
   }, [
      openCredenza,
      closeCredenza,
      bankAccounts,
      selectedCount,
      selectedIds,
      updateMutation,
      onClear,
   ]);

   const columns = useMemo(() => buildTransactionColumns(), []);

   if (transactionData.length === 0 && filters.page === 1) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <ArrowLeftRight className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhuma transação</EmptyTitle>
               <EmptyDescription>
                  {filters.search ||
                  filters.type ||
                  filters.dateFrom ||
                  (filters.conditionGroup?.conditions.length ?? 0) > 0
                     ? "Nenhuma transação encontrada para os filtros aplicados."
                     : "Registre uma nova transação para começar a controlar suas finanças."}
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   if (view === "card") {
      return (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {transactionData.map((transaction) => (
               <div
                  className="rounded-lg border bg-background p-4 space-y-3"
                  key={transaction.id}
               >
                  <div className="flex flex-col gap-1 min-w-0">
                     <p className="text-sm font-medium tabular-nums">
                        {transaction.date.split("-").reverse().join("/")}
                     </p>
                     {(transaction.name || transaction.description) && (
                        <p className="text-xs text-muted-foreground truncate">
                           {transaction.name || transaction.description}
                        </p>
                     )}
                  </div>
                  <div className="flex items-center gap-2">
                     <Button
                        onClick={() => handleEdit(transaction)}
                        variant="outline"
                     >
                        Editar
                     </Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(transaction)}
                        variant="ghost"
                     >
                        Excluir
                     </Button>
                  </div>
               </div>
            ))}
         </div>
      );
   }

   return (
      <>
         <DataTable
            columns={columns}
            columnVisibilityKey="transactions"
            data={transactionData}
            enableRowSelection
            getRowId={(row) => row.id}
            onRowSelectionChange={onRowSelectionChange}
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
                                 onClick={() => handleInstallment(tx)}
                              >
                                 <CalendarDays className="size-4" />
                                 Parcelar Transação
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                 onClick={() => handleRecurring(tx)}
                              >
                                 <Repeat className="size-4" />
                                 Criar Transação Recorrente
                              </DropdownMenuItem>
                           </DropdownMenuContent>
                        </DropdownMenu>
                     )}
                  </>
               );
            }}
            renderMobileCard={({ row }) => (
               <div className="rounded-lg border bg-background p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                     <div className="flex flex-col gap-1 min-w-0">
                        <p className="text-sm font-medium tabular-nums">
                           {row.original.date.split("-").reverse().join("/")}
                        </p>
                        {(row.original.name || row.original.description) && (
                           <p className="text-xs text-muted-foreground truncate">
                              {row.original.name || row.original.description}
                           </p>
                        )}
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Button
                        onClick={() => handleEdit(row.original)}
                        variant="outline"
                     >
                        Editar
                     </Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(row.original)}
                        variant="ghost"
                     >
                        Excluir
                     </Button>
                  </div>
               </div>
            )}
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
