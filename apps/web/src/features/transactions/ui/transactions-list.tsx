import { Button } from "@packages/ui/components/button";
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
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type {
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import dayjs from "dayjs";
import {
   AlertTriangle,
   ArrowLeftRight,
   Ban,
   CheckCircle2,
   FolderOpen,
   Landmark,
   MoreHorizontal,
   Pencil,
   Plus,
   RotateCcw,
   Trash2,
   Undo2,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useTransactionPrerequisites } from "@/features/transactions/hooks/use-transaction-prerequisites";
import { BulkCategorizeForm } from "@/features/transactions/ui/bulk-categorize-form";
import { BulkMoveAccountForm } from "@/features/transactions/ui/bulk-move-account-form";
import { TransactionCredenza } from "@/features/transactions/ui/transaction-credenza";
import { TransactionPrerequisitesBlocker } from "@/features/transactions/ui/transaction-prerequisites-blocker";
import {
   buildTransactionColumns,
   type TransactionRow,
} from "@/features/transactions/ui/transactions-columns";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { MarkPaidCredenza } from "@/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/mark-paid-credenza";

const routeApi = getRouteApi(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
);

export function TransactionsList() {
   const navigate = routeApi.useNavigate();
   const { slug, teamSlug } = routeApi.useParams();
   const {
      sorting,
      columnFilters,
      page,
      pageSize,
      view,
      overdueOnly,
      status,
      search,
   } = routeApi.useSearch();

   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const { hasBankAccounts } = useTransactionPrerequisites();

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         navigate({
            search: (prev) => ({ ...prev, sorting: next }),
            replace: true,
         });
      },
      [sorting, navigate],
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      useCallback(
         (updater) => {
            const next =
               typeof updater === "function" ? updater(columnFilters) : updater;
            navigate({
               search: (prev) => ({ ...prev, columnFilters: next }),
               replace: true,
            });
         },
         [columnFilters, navigate],
      );

   const handleSearch = useCallback(
      (value: string) => {
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         });
      },
      [navigate],
   );

   const handleOverdueToggle = useCallback(
      (checked: boolean) => {
         navigate({
            search: (prev) => ({ ...prev, overdueOnly: checked, page: 1 }),
            replace: true,
         });
      },
      [navigate],
   );

   const handlePageChange = useCallback(
      (newPage: number) => {
         navigate({
            search: (prev) => ({ ...prev, page: newPage }),
            replace: true,
         });
      },
      [navigate],
   );

   const handlePageSizeChange = useCallback(
      (newPageSize: number) => {
         navigate({
            search: (prev) => ({ ...prev, pageSize: newPageSize, page: 1 }),
            replace: true,
         });
      },
      [navigate],
   );

   const { data: result } = useSuspenseQuery(
      orpc.transactions.getAll.queryOptions({
         input: {
            search: search || undefined,
            view,
            overdueOnly,
            status: status.length > 0 ? status : undefined,
            page,
            pageSize,
         },
      }),
   );

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const transactionData = result.data;
   const total = result.total;
   const totalPages = Math.max(1, Math.ceil(total / pageSize));

   const deleteMutation = useMutation(
      orpc.transactions.remove.mutationOptions({
         onSuccess: () => toast.success("Lançamento excluído com sucesso."),
         onError: (error) =>
            toast.error(error.message || "Erro ao excluir lançamento."),
      }),
   );

   const updateMutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onError: (error) =>
            toast.error(error.message || "Erro ao atualizar lançamentos."),
      }),
   );

   const markAsPaidMutation = useMutation(
      orpc.transactions.markAsPaid.mutationOptions({
         onSuccess: () => toast.success("Lançamento marcado como pago."),
         onError: (error) =>
            toast.error(error.message || "Erro ao marcar como pago."),
      }),
   );

   const markAsUnpaidMutation = useMutation(
      orpc.transactions.markAsUnpaid.mutationOptions({
         onSuccess: () => toast.success("Pagamento desmarcado."),
         onError: (error) =>
            toast.error(error.message || "Erro ao desmarcar pagamento."),
      }),
   );

   const cancelMutation = useMutation(
      orpc.transactions.cancel.mutationOptions({
         onSuccess: () => toast.success("Lançamento cancelado."),
         onError: (error) =>
            toast.error(error.message || "Erro ao cancelar lançamento."),
      }),
   );

   const reactivateMutation = useMutation(
      orpc.transactions.reactivate.mutationOptions({
         onSuccess: () => toast.success("Lançamento reativado."),
         onError: (error) =>
            toast.error(error.message || "Erro ao reativar lançamento."),
      }),
   );

   const handleEdit = useCallback(
      (transaction: TransactionRow) => {
         openCredenza({
            renderChildren: () => (
               <TransactionCredenza
                  mode="edit"
                  onSuccess={closeCredenza}
                  transaction={transaction}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleCreate = useCallback(() => {
      if (!hasBankAccounts) {
         openCredenza({
            renderChildren: () => (
               <TransactionPrerequisitesBlocker
                  onAction={() => {
                     closeCredenza();
                     navigate({
                        to: "/$slug/$teamSlug/bank-accounts",
                        params: { slug, teamSlug },
                     });
                  }}
               />
            ),
         });
         return;
      }
      openCredenza({
         renderChildren: () => (
            <TransactionCredenza mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [hasBankAccounts, openCredenza, closeCredenza, navigate, slug, teamSlug]);

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

   const handleMarkPaid = useCallback(
      (tx: TransactionRow) => {
         markAsPaidMutation.mutate({
            id: tx.id,
            paidDate: dayjs().format("YYYY-MM-DD"),
         });
      },
      [markAsPaidMutation],
   );

   const handleMarkUnpaid = useCallback(
      (tx: TransactionRow) => {
         markAsUnpaidMutation.mutate({ id: tx.id });
      },
      [markAsUnpaidMutation],
   );

   const handleCancel = useCallback(
      (tx: TransactionRow) => {
         openAlertDialog({
            title: "Cancelar lançamento",
            description:
               "Tem certeza que deseja cancelar este lançamento? Ele ficará marcado como cancelado.",
            actionLabel: "Cancelar lançamento",
            cancelLabel: "Voltar",
            variant: "destructive",
            onAction: async () => {
               await cancelMutation.mutateAsync({ id: tx.id });
            },
         });
      },
      [openAlertDialog, cancelMutation],
   );

   const handleReactivate = useCallback(
      (tx: TransactionRow) => {
         reactivateMutation.mutate({ id: tx.id, paid: false });
      },
      [reactivateMutation],
   );

   const columns = useMemo(() => buildTransactionColumns(), []);

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <DataTableRoot
            columns={columns}
            columnFilters={columnFilters}
            data={transactionData}
            getRowId={(row) => row.id}
            onColumnFiltersChange={handleColumnFiltersChange}
            onSortingChange={handleSortingChange}
            renderActions={({ row }) => {
               const tx = row.original;
               const { status: rowStatus } = tx;
               return (
                  <>
                     <Button
                        onClick={() => handleEdit(tx)}
                        tooltip="Editar"
                        variant="outline"
                     >
                        <Pencil className="size-4" />
                     </Button>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button variant="outline">
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Mais ações</span>
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           <DropdownMenuLabel>Ações</DropdownMenuLabel>
                           <DropdownMenuSeparator />
                           {rowStatus === "pending" && (
                              <DropdownMenuItem
                                 onClick={() => handleMarkPaid(tx)}
                              >
                                 <CheckCircle2 className="size-4" />
                                 Marcar como pago
                              </DropdownMenuItem>
                           )}
                           {rowStatus === "paid" && (
                              <DropdownMenuItem
                                 onClick={() => handleMarkUnpaid(tx)}
                              >
                                 <Undo2 className="size-4" />
                                 Desmarcar pago
                              </DropdownMenuItem>
                           )}
                           {(rowStatus === "pending" ||
                              rowStatus === "paid") && (
                              <DropdownMenuItem
                                 onClick={() => handleCancel(tx)}
                              >
                                 <Ban className="size-4" />
                                 Cancelar
                              </DropdownMenuItem>
                           )}
                           {rowStatus === "cancelled" && (
                              <DropdownMenuItem
                                 onClick={() => handleReactivate(tx)}
                              >
                                 <RotateCcw className="size-4" />
                                 Reativar
                              </DropdownMenuItem>
                           )}
                           <DropdownMenuSeparator />
                           <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(tx)}
                           >
                              <Trash2 className="size-4" />
                              Excluir
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                     </DropdownMenu>
                  </>
               );
            }}
            sorting={sorting}
            storageKey="montte:datatable:transactions"
         >
            <DataTableExternalFilter
               id="overdueOnly"
               label="Somente vencidos"
               group="Filtros"
               active={overdueOnly}
               renderIcon={() => <AlertTriangle className="size-4" />}
               onToggle={handleOverdueToggle}
            />
            <DataTableToolbar
               searchPlaceholder="Buscar por nome, descrição ou contato..."
               searchDefaultValue={search}
               onSearch={handleSearch}
            >
               <Button
                  onClick={handleCreate}
                  tooltip="Novo Lançamento"
                  variant="outline"
                  size="icon-sm"
               >
                  <Plus />
                  <span className="sr-only">Novo Lançamento</span>
               </Button>
            </DataTableToolbar>
            <DataTableEmptyState>
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <ArrowLeftRight className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum lançamento</EmptyTitle>
                     <EmptyDescription>
                        {search
                           ? "Nenhum lançamento encontrado para os filtros aplicados."
                           : "Registre um novo lançamento para começar a controlar suas finanças."}
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            </DataTableEmptyState>
            <DataTableContent className="flex-1 overflow-auto min-h-0" />
            <DataTableBulkActions<TransactionRow>>
               {({ selectedRows, clearSelection }) => {
                  const pendingIds = selectedRows
                     .filter((r) => r.status === "pending")
                     .map((r) => r.id);
                  const selectedIds = selectedRows.map((r) => r.id);
                  const allPending =
                     pendingIds.length === selectedIds.length &&
                     selectedIds.length > 0;
                  return (
                     <>
                        {allPending && (
                           <SelectionActionButton
                              icon={<CheckCircle2 />}
                              onClick={() =>
                                 openCredenza({
                                    renderChildren: () => (
                                       <MarkPaidCredenza
                                          ids={selectedIds}
                                          onSuccess={() => {
                                             clearSelection();
                                             closeCredenza();
                                          }}
                                       />
                                    ),
                                 })
                              }
                           >
                              Marcar como pagas
                           </SelectionActionButton>
                        )}
                        <SelectionActionButton
                           icon={<FolderOpen />}
                           onClick={() =>
                              openCredenza({
                                 renderChildren: () => (
                                    <BulkCategorizeForm
                                       onApply={async (categoryId) => {
                                          await Promise.all(
                                             selectedIds.map((id) =>
                                                updateMutation.mutateAsync({
                                                   id,
                                                   categoryId,
                                                }),
                                             ),
                                          );
                                          clearSelection();
                                          closeCredenza();
                                          toast.success(
                                             `${selectedIds.length} ${selectedIds.length === 1 ? "lançamento categorizado" : "lançamentos categorizados"}.`,
                                          );
                                       }}
                                       onCancel={closeCredenza}
                                       selectedCount={selectedIds.length}
                                    />
                                 ),
                              })
                           }
                        >
                           Categorizar
                        </SelectionActionButton>
                        <SelectionActionButton
                           icon={<Landmark />}
                           onClick={() =>
                              openCredenza({
                                 renderChildren: () => (
                                    <BulkMoveAccountForm
                                       bankAccounts={bankAccounts}
                                       onApply={async (
                                          bankAccountId,
                                          destinationBankAccountId,
                                       ) => {
                                          await Promise.all(
                                             selectedIds.map((id) =>
                                                updateMutation.mutateAsync({
                                                   id,
                                                   bankAccountId,
                                                   destinationBankAccountId,
                                                }),
                                             ),
                                          );
                                          clearSelection();
                                          closeCredenza();
                                          toast.success(
                                             `${selectedIds.length} ${selectedIds.length === 1 ? "lançamento convertido" : "lançamentos convertidos"} em transferências.`,
                                          );
                                       }}
                                       onCancel={closeCredenza}
                                       selectedCount={selectedIds.length}
                                    />
                                 ),
                              })
                           }
                        >
                           Mover conta
                        </SelectionActionButton>
                        <SelectionActionButton
                           icon={<Trash2 />}
                           onClick={() =>
                              openAlertDialog({
                                 title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "lançamento" : "lançamentos"}`,
                                 description:
                                    "Tem certeza que deseja excluir os lançamentos selecionados? Esta ação não pode ser desfeita.",
                                 actionLabel: "Excluir",
                                 cancelLabel: "Cancelar",
                                 variant: "destructive",
                                 onAction: async () => {
                                    await Promise.all(
                                       selectedIds.map((id) =>
                                          deleteMutation.mutateAsync({ id }),
                                       ),
                                    );
                                    clearSelection();
                                 },
                              })
                           }
                           variant="destructive"
                        >
                           Excluir
                        </SelectionActionButton>
                     </>
                  );
               }}
            </DataTableBulkActions>
         </DataTableRoot>
         <DataTablePagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
         />
      </div>
   );
}
