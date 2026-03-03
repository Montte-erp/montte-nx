import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DataTable } from "@packages/ui/components/data-table";
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
import { Skeleton } from "@packages/ui/components/skeleton";
import { useRowSelection } from "@packages/ui/hooks/use-row-selection";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
   ArrowLeftRight,
   ArrowRight,
   Download,
   FolderOpen,
   Landmark,
   LayoutGrid,
   LayoutList,
   Loader2,
   Plus,
   Trash2,
   Upload,
} from "lucide-react";
import {
   Suspense,
   useCallback,
   useEffect,
   useMemo,
   useState,
   useTransition,
} from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import type { PanelAction } from "@/features/context-panel/context-panel-store";
import { BillFromTransactionCredenza } from "@/features/bills/ui/bill-from-transaction-credenza";
import { TransactionExportCredenza } from "@/features/transactions/ui/transaction-export-credenza";
import {
   TransactionFilterBar,
   type TransactionFilters,
   DEFAULT_FILTERS,
} from "@/features/transactions/ui/transaction-filter-bar";
import { TransactionImportCredenza } from "@/features/transactions/ui/transaction-import-credenza";
import {
   buildTransactionColumns,
   type TransactionRow,
} from "@/features/transactions/ui/transactions-columns";
import { useTransactionPrerequisites } from "@/features/transactions/hooks/use-transaction-prerequisites";
import { TransactionPrerequisitesBlocker } from "@/features/transactions/ui/transaction-prerequisites-blocker";
import { TransactionSheet } from "@/features/transactions/ui/transactions-sheet";
import type { ViewConfig } from "@/features/view-switch/hooks/use-view-switch";
import { useViewSwitch } from "@/features/view-switch/hooks/use-view-switch";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(orpc.tags.getAll.queryOptions({}));
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.transactions.getAll.queryOptions({
            input: { page: 1, pageSize: 20 },
         }),
      );
   },
   component: TransactionsPage,
});

const TRANSACTION_VIEWS: [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

// =============================================================================
// Bulk action forms
// =============================================================================

function BulkCategorizeForm({
   selectedCount,
   onApply,
   onCancel,
}: {
   selectedCount: number;
   onApply: (categoryId: string) => Promise<void>;
   onCancel: () => void;
}) {
   const [categoryId, setCategoryId] = useState<string | undefined>();
   const [isPending, startTransition] = useTransition();
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Categorizar transações</CredenzaTitle>
            <CredenzaDescription>
               Aplicar categoria a {selectedCount}{" "}
               {selectedCount === 1 ? "transação" : "transações"}
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <Combobox
               emptyMessage="Nenhuma categoria encontrada."
               onValueChange={setCategoryId}
               options={categories.map((c) => ({ value: c.id, label: c.name }))}
               placeholder="Selecionar categoria..."
               searchPlaceholder="Buscar categoria..."
               value={categoryId}
            />
         </CredenzaBody>
         <CredenzaFooter className="flex-col gap-2">
            <Button
               className="w-full"
               disabled={isPending}
               onClick={onCancel}
               variant="outline"
            >
               Cancelar
            </Button>
            <Button
               className="w-full"
               disabled={!categoryId || isPending}
               onClick={() =>
                  startTransition(async () => {
                     await onApply(categoryId!);
                  })
               }
            >
               {isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
               Aplicar
            </Button>
         </CredenzaFooter>
      </>
   );
}

function BulkMoveAccountForm({
   bankAccounts,
   selectedCount,
   onApply,
   onCancel,
}: {
   bankAccounts: Array<{ id: string; name: string }>;
   selectedCount: number;
   onApply: (
      bankAccountId: string,
      destinationBankAccountId: string,
   ) => Promise<void>;
   onCancel: () => void;
}) {
   const [bankAccountId, setBankAccountId] = useState<string | undefined>();
   const [destinationBankAccountId, setDestinationBankAccountId] = useState<
      string | undefined
   >();
   const [isPending, startTransition] = useTransition();
   const options = bankAccounts.map((a) => ({ value: a.id, label: a.name }));

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Transferir transações</CredenzaTitle>
            <CredenzaDescription>
               Converter {selectedCount}{" "}
               {selectedCount === 1 ? "transação" : "transações"} em
               transferências entre contas
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
               <p className="text-sm font-medium">Conta de Origem</p>
               <Combobox
                  emptyMessage="Nenhuma conta encontrada."
                  onValueChange={setBankAccountId}
                  options={options}
                  placeholder="Origem..."
                  searchPlaceholder="Buscar conta..."
                  value={bankAccountId}
               />
            </div>
            <ArrowRight className="size-4 mb-[18px] shrink-0 text-muted-foreground" />
            <div className="flex-1 space-y-2">
               <p className="text-sm font-medium">Conta de Destino</p>
               <Combobox
                  emptyMessage="Nenhuma conta encontrada."
                  onValueChange={setDestinationBankAccountId}
                  options={options}
                  placeholder="Destino..."
                  searchPlaceholder="Buscar conta..."
                  value={destinationBankAccountId}
               />
            </div>
         </CredenzaBody>
         <CredenzaFooter className="grid gap-2 w-full">
            <Button
               className="w-full"
               disabled={isPending}
               onClick={onCancel}
               variant="outline"
            >
               Cancelar
            </Button>
            <Button
               className="w-full"
               disabled={
                  !bankAccountId || !destinationBankAccountId || isPending
               }
               onClick={() =>
                  startTransition(async () => {
                     await onApply(
                        bankAccountId ?? "",
                        destinationBankAccountId ?? "",
                     );
                  })
               }
            >
               {isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
               Aplicar
            </Button>
         </CredenzaFooter>
      </>
   );
}

// =============================================================================
// Filters
// =============================================================================

// =============================================================================
// Skeleton
// =============================================================================

function TransactionsSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// Filter child components
// =============================================================================

// =============================================================================
// Filter Bar
// =============================================================================

// =============================================================================
// List
// =============================================================================

interface TransactionsListProps {
   filters: TransactionFilters;
   onPageChange: (page: number) => void;
   onPageSizeChange: (size: number) => void;
   view: "table" | "card";
}

function TransactionsList({
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

   const columns = useMemo(
      () =>
         buildTransactionColumns(
            handleEdit,
            handleDelete,
            handleInstallment,
            handleRecurring,
         ),
      [handleEdit, handleDelete, handleInstallment, handleRecurring],
   );

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

// =============================================================================
// Page
// =============================================================================

function TransactionsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const navigate = useNavigate();
   const { slug, teamSlug } = Route.useParams();
   const { hasBankAccounts } = useTransactionPrerequisites();
   const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
   const { currentView, setView, views } = useViewSwitch(
      "finance:transactions:view",
      TRANSACTION_VIEWS,
   );

   const handleCreate = useCallback(() => {
      if (!hasBankAccounts) {
         openCredenza({
            children: (
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
         children: <TransactionSheet mode="create" onSuccess={closeCredenza} />,
      });
   }, [hasBankAccounts, openCredenza, closeCredenza, navigate, slug, teamSlug]);

   useEffect(() => {
      const handler = (e: Event) => {
         const detail = (e as CustomEvent<{ itemId: string }>).detail;
         if (detail.itemId === "transactions") {
            handleCreate();
         }
      };
      window.addEventListener("sidebar:quick-create", handler);
      return () => window.removeEventListener("sidebar:quick-create", handler);
   }, [handleCreate]);

   const panelActions: PanelAction[] = [
      {
         icon: Upload,
         label: "Importar",
         onClick: () => openCredenza({ children: <TransactionImportCredenza /> }),
      },
      {
         icon: Download,
         label: "Exportar",
         onClick: () =>
            openCredenza({
               children: (
                  <TransactionExportCredenza
                     dateFrom={filters.dateFrom}
                     dateTo={filters.dateTo}
                  />
               ),
            }),
      },
   ];

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4 mr-1" />
                  Nova Transação
               </Button>
            }
            description="Gerencie suas receitas, despesas e transferências"
            panelActions={panelActions}
            title="Transações"
            viewSwitch={{ options: views, currentView, onViewChange: setView }}
         />
         <TransactionFilterBar filters={filters} onFiltersChange={setFilters} />
         <Suspense fallback={<TransactionsSkeleton />}>
            <TransactionsList
               filters={filters}
               onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
               onPageSizeChange={(pageSize) =>
                  setFilters((f) => ({ ...f, pageSize, page: 1 }))
               }
               view={currentView}
            />
         </Suspense>
      </main>
   );
}
