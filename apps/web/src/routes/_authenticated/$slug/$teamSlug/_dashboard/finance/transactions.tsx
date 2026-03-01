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
import { DateRangePicker } from "@packages/ui/components/date-range-picker";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Input } from "@packages/ui/components/input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { useRowSelection } from "@packages/ui/hooks/use-row-selection";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   ArrowLeftRight,
   ArrowRight,
   Calendar,
   Download,
   FolderOpen,
   Landmark,
   LayoutGrid,
   LayoutList,
   Loader2,
   Plus,
   Search,
   Trash2,
   Upload,
   X,
} from "lucide-react";
import {
   Suspense,
   useCallback,
   useMemo,
   useRef,
   useState,
   useTransition,
} from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { TransactionExportCredenza } from "@/features/transactions/ui/transaction-export-credenza";
import { TransactionImportCredenza } from "@/features/transactions/ui/transaction-import-credenza";
import {
   buildTransactionColumns,
   type TransactionRow,
} from "@/features/transactions/ui/transactions-columns";
import { TransactionSheet } from "@/features/transactions/ui/transactions-sheet";
import { BillFromTransactionCredenza } from "@/features/bills/ui/bill-from-transaction-credenza";
import type { ViewConfig } from "@/features/view-switch/hooks/use-view-switch";
import { useViewSwitch } from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions",
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
               size="sm"
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
               size="sm"
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

type TransactionType = "income" | "expense" | "transfer";

interface TransactionFilters {
   type?: TransactionType;
   dateFrom?: string;
   dateTo?: string;
   datePreset?: string;
   search: string;
   page: number;
   pageSize: number;
}

const DEFAULT_FILTERS: TransactionFilters = {
   search: "",
   page: 1,
   pageSize: 20,
};

const DATE_RANGE_PRESETS = [
   { label: "Hoje", value: "today" },
   { label: "Últimos 7 dias", value: "7d" },
   { label: "Este mês", value: "this_month" },
   { label: "Mês passado", value: "last_month" },
   { label: "Este ano", value: "this_year" },
] as const;

function presetToDateRange(preset: string): {
   dateFrom: string;
   dateTo: string;
} {
   const today = new Date();
   const fmt = (d: Date) => d.toISOString().split("T")[0];
   switch (preset) {
      case "today":
         return { dateFrom: fmt(today), dateTo: fmt(today) };
      case "7d": {
         const from = new Date(today);
         from.setDate(from.getDate() - 6);
         return { dateFrom: fmt(from), dateTo: fmt(today) };
      }
      case "this_month": {
         const from = new Date(today.getFullYear(), today.getMonth(), 1);
         const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
         return { dateFrom: fmt(from), dateTo: fmt(to) };
      }
      case "last_month": {
         const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
         const to = new Date(today.getFullYear(), today.getMonth(), 0);
         return { dateFrom: fmt(from), dateTo: fmt(to) };
      }
      case "this_year": {
         const from = new Date(today.getFullYear(), 0, 1);
         const to = new Date(today.getFullYear(), 11, 31);
         return { dateFrom: fmt(from), dateTo: fmt(to) };
      }
      default:
         return { dateFrom: fmt(today), dateTo: fmt(today) };
   }
}

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
// Filter Bar
// =============================================================================

interface FilterBarProps {
   filters: TransactionFilters;
   onFiltersChange: (filters: TransactionFilters) => void;
}

function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
   const [isDateOpen, setIsDateOpen] = useState(false);

   // Debounce search via timeout ref
   const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   const [searchInput, setSearchInput] = useState(filters.search);

   const handleSearchChange = (value: string) => {
      setSearchInput(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
         onFiltersChange({ ...filters, search: value, page: 1 });
      }, 350);
   };

   const hasDateFilter = !!(filters.dateFrom || filters.dateTo);

   const dateLabel = useMemo(() => {
      if (filters.datePreset) {
         return (
            DATE_RANGE_PRESETS.find((p) => p.value === filters.datePreset)
               ?.label ?? "Período"
         );
      }
      if (filters.dateFrom && filters.dateTo) {
         const fmt = (s: string) =>
            new Date(`${s}T00:00:00`).toLocaleDateString("pt-BR", {
               day: "numeric",
               month: "short",
            });
         return `${fmt(filters.dateFrom)} – ${fmt(filters.dateTo)}`;
      }
      return "Período";
   }, [filters.datePreset, filters.dateFrom, filters.dateTo]);

   const selectedRange = useMemo(() => {
      if (filters.datePreset || !filters.dateFrom || !filters.dateTo)
         return null;
      return {
         from: new Date(`${filters.dateFrom}T00:00:00`),
         to: new Date(`${filters.dateTo}T00:00:00`),
      };
   }, [filters.datePreset, filters.dateFrom, filters.dateTo]);

   const hasActiveFilters =
      filters.type || hasDateFilter || filters.search.length > 0;

   return (
      <div className="flex flex-wrap items-center gap-2">
         {/* Search */}
         <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
               className="pl-8 h-8 w-[220px]"
               onChange={(e) => handleSearchChange(e.target.value)}
               placeholder="Buscar transação..."
               value={searchInput}
            />
         </div>

         {/* Type chips */}
         <ToggleGroup
            onValueChange={(v) =>
               onFiltersChange({
                  ...filters,
                  type: (v as TransactionType) || undefined,
                  page: 1,
               })
            }
            spacing={1}
            type="single"
            value={filters.type ?? ""}
            variant="outline"
         >
            <ToggleGroupItem size="sm" value="">
               Todos
            </ToggleGroupItem>
            <ToggleGroupItem size="sm" value="income">
               Receita
            </ToggleGroupItem>
            <ToggleGroupItem size="sm" value="expense">
               Despesa
            </ToggleGroupItem>
            <ToggleGroupItem size="sm" value="transfer">
               Transferência
            </ToggleGroupItem>
         </ToggleGroup>

         {/* Date range */}
         <Popover onOpenChange={setIsDateOpen} open={isDateOpen}>
            <PopoverTrigger asChild>
               <Button
                  className="h-8 gap-1.5"
                  size="sm"
                  variant={hasDateFilter ? "secondary" : "outline"}
               >
                  <Calendar className="size-3.5" />
                  {dateLabel}
               </Button>
            </PopoverTrigger>
            <PopoverContent
               align="start"
               className="w-auto p-0"
               onInteractOutside={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("[data-radix-popper-content-wrapper]")) {
                     e.preventDefault();
                  }
               }}
            >
               <DateRangePicker
                  heading="Período"
                  onPresetSelect={(preset) => {
                     const { dateFrom, dateTo } = presetToDateRange(preset);
                     onFiltersChange({
                        ...filters,
                        dateFrom,
                        dateTo,
                        datePreset: preset,
                        page: 1,
                     });
                     setIsDateOpen(false);
                  }}
                  onRangeSelect={(range) => {
                     const fmt = (d: Date) => d.toISOString().split("T")[0];
                     onFiltersChange({
                        ...filters,
                        dateFrom: fmt(range.from),
                        dateTo: fmt(range.to),
                        datePreset: undefined,
                        page: 1,
                     });
                     setIsDateOpen(false);
                  }}
                  presets={DATE_RANGE_PRESETS}
                  selectedPreset={filters.datePreset ?? null}
                  selectedRange={selectedRange}
               />
               {hasDateFilter && (
                  <div className="border-t p-2">
                     <Button
                        className="w-full"
                        onClick={() => {
                           onFiltersChange({
                              ...filters,
                              dateFrom: undefined,
                              dateTo: undefined,
                              datePreset: undefined,
                              page: 1,
                           });
                           setIsDateOpen(false);
                        }}
                        size="sm"
                        variant="ghost"
                     >
                        Limpar período
                     </Button>
                  </div>
               )}
            </PopoverContent>
         </Popover>

         {/* Clear all */}
         {hasActiveFilters && (
            <Button
               className="h-8 gap-1"
               onClick={() => {
                  setSearchInput("");
                  onFiltersChange(DEFAULT_FILTERS);
               }}
               size="sm"
               variant="ghost"
            >
               <X className="size-3.5" />
               Limpar
            </Button>
         )}
      </div>
   );
}

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
                  mode="installment"
                  transactionId={tx.id}
                  transactionName={tx.name ?? ""}
                  transactionAmount={tx.amount}
                  transactionDate={tx.date}
                  transactionType={tx.type}
                  bankAccountId={tx.bankAccountId}
                  categoryId={tx.categoryId}
                  onSuccess={closeCredenza}
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
                  mode="recurring"
                  transactionId={tx.id}
                  transactionName={tx.name ?? ""}
                  transactionAmount={tx.amount}
                  transactionDate={tx.date}
                  transactionType={tx.type}
                  bankAccountId={tx.bankAccountId}
                  categoryId={tx.categoryId}
                  onSuccess={closeCredenza}
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
      () => buildTransactionColumns(handleEdit, handleDelete, handleInstallment, handleRecurring),
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
                  {filters.search || filters.type || filters.dateFrom
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
                        size="sm"
                        variant="outline"
                     >
                        Editar
                     </Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(transaction)}
                        size="sm"
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
                        size="sm"
                        variant="outline"
                     >
                        Editar
                     </Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(row.original)}
                        size="sm"
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
   const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
   const { currentView, setView, views } = useViewSwitch(
      "finance:transactions:view",
      TRANSACTION_VIEWS,
   );

   const handleCreate = useCallback(() => {
      openCredenza({
         children: <TransactionSheet mode="create" onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <div className="flex items-center gap-2">
                  <Button
                     onClick={() =>
                        openCredenza({
                           children: <TransactionImportCredenza />,
                        })
                     }
                     size="sm"
                     variant="outline"
                  >
                     <Upload className="size-4 mr-1" />
                     Importar
                  </Button>
                  <Button
                     onClick={() =>
                        openCredenza({
                           children: (
                              <TransactionExportCredenza
                                 dateFrom={filters.dateFrom}
                                 dateTo={filters.dateTo}
                              />
                           ),
                        })
                     }
                     size="sm"
                     variant="outline"
                  >
                     <Download className="size-4 mr-1" />
                     Exportar
                  </Button>
                  <Button onClick={handleCreate} size="sm">
                     <Plus className="size-4 mr-1" />
                     Nova Transação
                  </Button>
               </div>
            }
            description="Gerencie suas receitas, despesas e transferências"
            title="Transações"
            viewSwitch={
               <ViewSwitchDropdown
                  currentView={currentView}
                  onViewChange={setView}
                  views={views}
               />
            }
         />
         <FilterBar filters={filters} onFiltersChange={setFilters} />
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
