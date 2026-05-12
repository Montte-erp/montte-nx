import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   getCoreRowModel,
   getExpandedRowModel,
   useReactTable,
   type ColumnDef,
   type ColumnFiltersState,
   type PaginationState,
   type RowSelectionState,
   type SortingState,
} from "@tanstack/react-table";
import {
   ChevronDown,
   ChevronRight,
   CreditCard,
   Plus,
   Trash2,
} from "lucide-react";
import { startTransition, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "../-layout/default-header";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { DataImportButton } from "@/blocks/data-table/data-import/data-import-button";
import { DataImportSection } from "@/blocks/data-table/data-import/data-import-section";
import { useDataImport } from "@/blocks/data-table/data-import/use-data-import";
import type { DataImportConfig } from "@/blocks/data-table/data-import/types";
import { QueryBoundary } from "@/components/query-boundary";
import { useSheet } from "@/hooks/use-sheet";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import { CreditCardFormSheet } from "./-credit-cards/credit-card-form-sheet";
import {
   buildCreditCardColumns,
   type CreditCardRow,
} from "./-credit-cards/credit-cards-columns";
import { CreditCardFaturaRow } from "./-credit-cards/credit-card-fatura-row";

const creditCardsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   search: z.string().max(100).catch("").default(""),
   status: z
      .union([z.enum(["active", "blocked", "cancelled"]), z.undefined()])
      .catch(undefined),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

const skeletonColumns = buildCreditCardColumns();

type CreditCardBrand =
   | "visa"
   | "mastercard"
   | "elo"
   | "amex"
   | "hipercard"
   | "other";

type CreditCardStatus = "active" | "blocked" | "cancelled";

function normalizeImportLookup(value: unknown): string {
   return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
}

function resolveBankAccountId(
   bankAccounts: Array<{ id: string; name: string }>,
   value: unknown,
): string | null {
   const normalized = normalizeImportLookup(value);
   if (!normalized) return null;
   const bankAccount = bankAccounts.find(
      (item) =>
         normalizeImportLookup(item.id) === normalized ||
         normalizeImportLookup(item.name) === normalized,
   );
   return bankAccount?.id ?? null;
}

function parseCreditCardBrand(value: unknown): CreditCardBrand | undefined {
   const normalized = normalizeImportLookup(value);
   if (normalized === "visa") return "visa";
   if (normalized === "mastercard") return "mastercard";
   if (normalized === "elo") return "elo";
   if (normalized === "amex") return "amex";
   if (normalized === "hipercard") return "hipercard";
   if (normalized === "other") return "other";
   return undefined;
}

function parseCreditCardStatus(value: unknown): CreditCardStatus {
   const normalized = normalizeImportLookup(value);
   if (normalized === "blocked" || normalized === "bloqueado") {
      return "blocked";
   }
   if (normalized === "cancelled" || normalized === "cancelado") {
      return "cancelled";
   }
   return "active";
}

function parseImportDay(value: unknown, fallback: number): number {
   const parsed = Number.parseInt(String(value ?? ""), 10);
   if (Number.isNaN(parsed) || parsed < 1 || parsed > 31) return fallback;
   return parsed;
}

function normalizeLast4(value: unknown): string | null {
   const digits = String(value ?? "")
      .replace(/\D/g, "")
      .slice(0, 4);
   return digits.length === 4 ? digits : null;
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/credit-cards",
)({
   validateSearch: creditCardsSearchSchema,
   loaderDeps: ({ search: { page, pageSize, search, status } }) => ({
      page,
      pageSize,
      search,
      status,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({
            input: {
               page: deps.page,
               pageSize: deps.pageSize,
               search: deps.search || undefined,
               status: deps.status,
            },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
   },
   pendingMs: 300,
   pendingComponent: CreditCardsSkeleton,
   head: () => ({
      meta: [{ title: "Cartões de Crédito — Montte" }],
   }),
   component: CreditCardsPage,
});

function CreditCardsSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function CreditCardsList() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, page, pageSize, search, status } =
      Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const { publicEnv } = Route.useRouteContext();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx, generate: generateXlsx } = useXlsxFile();
   const layout = useDataTableLayout("credit-cards");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

   const [{ data: result }, { data: bankAccounts }] = useSuspenseQueries({
      queries: [
         orpc.creditCards.getAll.queryOptions({
            input: { page, pageSize, search: search || undefined, status },
         }),
         orpc.bankAccounts.getAll.queryOptions({}),
      ],
   });

   const deleteMutation = useMutation(
      orpc.creditCards.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Cartão de crédito excluído com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir cartão de crédito.");
         },
      }),
   );

   const bulkCreateMutation = useMutation(
      orpc.creditCards.bulkCreate.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.creditCards.bulkRemove.mutationOptions({
         onSuccess: ({ deleted }) => {
            toast.success(
               `${deleted} ${deleted === 1 ? "cartão excluído" : "cartões excluídos"} com sucesso.`,
            );
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir cartões.");
         },
      }),
   );

   const handleOpenCreate = useCallback(() => {
      openSheet({ renderChildren: () => <CreditCardFormSheet /> });
   }, [openSheet]);

   const importConfig: DataImportConfig = useMemo(
      () => ({
         accept: {
            "text/csv": [".csv"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
               [".xlsx"],
            "application/vnd.ms-excel": [".xls"],
         },
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         importColumns: [{ key: "last4", label: "Final" }],
         mapRow: (row, i) => ({
            id: `__import_${i}`,
            name: String(row.name ?? "").trim(),
            brand: parseCreditCardBrand(row.brand),
            last4: normalizeLast4(row.last4 ?? row.final),
            color: "#6366f1",
            creditLimit: String(row.creditLimit ?? row.limite ?? "0"),
            closingDay: parseImportDay(row.closingDay ?? row.fechamento, 1),
            dueDay: parseImportDay(row.dueDay ?? row.vencimento, 1),
            bankAccountId: resolveBankAccountId(
               bankAccounts ?? [],
               row.bankAccountId,
            ),
            status: parseCreditCardStatus(row.status),
         }),
         template: {
            label: "Baixar modelo",
            description:
               "Inclui Nome, Bandeira, Final, Limite, Fechamento, Vencimento, Conta Bancária e Status.",
            formats: [
               {
                  filename: "modelo-cartoes-credito.csv",
                  label: "CSV",
                  createBlob: () =>
                     generateCsv(
                        [
                           {
                              Nome: "Cartão Principal",
                              Bandeira: "visa",
                              Final: "1234",
                              Limite: "5000.00",
                              Fechamento: "10",
                              Vencimento: "20",
                              "Conta Bancária": bankAccounts?.[0]?.name ?? "",
                              Status: "Ativo",
                           },
                        ],
                        [
                           "Nome",
                           "Bandeira",
                           "Final",
                           "Limite",
                           "Fechamento",
                           "Vencimento",
                           "Conta Bancária",
                           "Status",
                        ],
                     ),
               },
               {
                  filename: "modelo-cartoes-credito.xlsx",
                  label: "XLSX",
                  createBlob: () =>
                     generateXlsx(
                        [
                           {
                              Nome: "Cartão Principal",
                              Bandeira: "visa",
                              Final: "1234",
                              Limite: "5000.00",
                              Fechamento: "10",
                              Vencimento: "20",
                              "Conta Bancária": bankAccounts?.[0]?.name ?? "",
                              Status: "Ativo",
                           },
                        ],
                        [
                           "Nome",
                           "Bandeira",
                           "Final",
                           "Limite",
                           "Fechamento",
                           "Vencimento",
                           "Conta Bancária",
                           "Status",
                        ],
                     ),
               },
            ],
         },
         onImport: async (rows) => {
            const firstBankAccountId = bankAccounts?.[0]?.id;
            if (!firstBankAccountId) {
               toast.error(
                  "Nenhuma conta bancária disponível para importação.",
               );
               return;
            }
            await bulkCreateMutation.mutateAsync({
               cards: rows.map((r) => ({
                  name: String(r.name ?? ""),
                  closingDay:
                     typeof r.closingDay === "number" ? r.closingDay : 1,
                  dueDay: typeof r.dueDay === "number" ? r.dueDay : 1,
                  bankAccountId:
                     resolveBankAccountId(
                        bankAccounts ?? [],
                        r.bankAccountId,
                     ) ?? firstBankAccountId,
                  color: "#6366f1",
                  creditLimit: String(r.creditLimit ?? "0"),
                  last4: normalizeLast4(r.last4),
                  brand: parseCreditCardBrand(r.brand),
                  status: parseCreditCardStatus(r.status),
               })),
            });
         },
      }),
      [
         bulkCreateMutation,
         generateCsv,
         generateXlsx,
         parseCsv,
         parseXlsx,
         bankAccounts,
      ],
   );

   const handleDelete = useCallback(
      (card: CreditCardRow) => {
         openAlertDialog({
            title: "Excluir cartão de crédito",
            description: `Tem certeza que deseja excluir o cartão "${card.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: card.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo<ColumnDef<CreditCardRow>[]>(() => {
      const base = buildCreditCardColumns({
         bankAccounts: (bankAccounts ?? []).map((b) => ({
            id: b.id,
            name: b.name,
            bankName: b.bankName,
            bankCode: b.bankCode,
            color: b.color,
         })),
         logoDevToken: publicEnv?.LOGO_DEV_TOKEN,
      });
      const selectColumn: ColumnDef<CreditCardRow> = {
         id: "__select",
         size: 40,
         enableSorting: false,
         enableHiding: false,
         header: ({ table }) => (
            <Checkbox
               aria-label="Selecionar todos"
               checked={
                  table.getIsAllPageRowsSelected()
                     ? true
                     : table.getIsSomePageRowsSelected()
                       ? "indeterminate"
                       : false
               }
               onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            />
         ),
         cell: ({ row }) => (
            <Checkbox
               aria-label="Selecionar linha"
               checked={row.getIsSelected()}
               disabled={!row.getCanSelect()}
               onCheckedChange={(v) => row.toggleSelected(!!v)}
            />
         ),
      };
      const expandColumn: ColumnDef<CreditCardRow> = {
         id: "__expand",
         size: 40,
         enableSorting: false,
         enableHiding: false,
         cell: ({ row }) => (
            <Button
               aria-label={row.getIsExpanded() ? "Recolher" : "Expandir"}
               onClick={() => row.toggleExpanded()}
               size="icon-sm"
               tooltip={row.getIsExpanded() ? "Recolher fatura" : "Ver fatura"}
               variant="ghost"
            >
               {row.getIsExpanded() ? <ChevronDown /> : <ChevronRight />}
            </Button>
         ),
      };
      const actionsColumn: ColumnDef<CreditCardRow> = {
         id: "__actions",
         size: 60,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  size="icon-sm"
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 />
               </Button>
            </div>
         ),
      };
      return [selectColumn, expandColumn, ...base, actionsColumn];
   }, [bankAccounts, publicEnv?.LOGO_DEV_TOKEN, handleDelete]);

   const handleSortingChange = useCallback(
      (updater: SortingState | ((prev: SortingState) => SortingState)) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         startTransition(() => {
            navigate({
               search: (prev) => ({ ...prev, sorting: next, page: 1 }),
               replace: true,
            });
         });
      },
      [navigate, sorting],
   );

   const handleColumnFiltersChange = useCallback(
      (
         updater:
            | ColumnFiltersState
            | ((prev: ColumnFiltersState) => ColumnFiltersState),
      ) => {
         const next =
            typeof updater === "function" ? updater(columnFilters) : updater;
         const statusFilter = next.find((f) => f.id === "status");
         startTransition(() => {
            navigate({
               search: (prev) => ({
                  ...prev,
                  columnFilters: next,
                  status: creditCardsSearchSchema.shape.status.parse(
                     statusFilter?.value,
                  ),
                  page: 1,
               }),
               replace: true,
            });
         });
      },
      [navigate, columnFilters],
   );

   const handlePaginationChange = useCallback(
      (
         updater:
            | PaginationState
            | ((prev: PaginationState) => PaginationState),
      ) => {
         const current: PaginationState = { pageIndex: page - 1, pageSize };
         const next =
            typeof updater === "function" ? updater(current) : updater;
         startTransition(() => {
            navigate({
               search: (prev) => ({
                  ...prev,
                  page: next.pageIndex + 1,
                  pageSize: next.pageSize,
               }),
               replace: true,
            });
         });
      },
      [navigate, page, pageSize],
   );

   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const table = useReactTable({
      data: result.data,
      columns,
      getRowId: (row) => row.id,
      pageCount: result.totalPages,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      state: {
         sorting,
         columnFilters,
         pagination: { pageIndex: page - 1, pageSize },
         rowSelection,
      },
      onSortingChange: handleSortingChange,
      onColumnFiltersChange: handleColumnFiltersChange,
      onPaginationChange: handlePaginationChange,
      onRowSelectionChange: setRowSelection,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      initialState: {
         columnSizing: layout.initialState.columnSizing,
         columnOrder: layout.initialState.columnOrder,
         columnVisibility: layout.initialState.columnVisibility,
         columnPinning: layout.initialState.columnPinning,
      },
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      getRowCanExpand: () => true,
   });

   const importApi = useDataImport({ table, config: importConfig });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((r) => r.original.id);

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <SelectionActionButton
            icon={<Trash2 />}
            variant="destructive"
            onClick={() => {
               openAlertDialog({
                  title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "cartão" : "cartões"}`,
                  description:
                     "Tem certeza que deseja excluir os cartões selecionados? Esta ação não pode ser desfeita.",
                  actionLabel: "Excluir",
                  cancelLabel: "Cancelar",
                  variant: "destructive",
                  onAction: async () => {
                     await bulkDeleteMutation.mutateAsync({ ids: selectedIds });
                     table.resetRowSelection();
                  },
               });
            }}
         >
            Excluir
         </SelectionActionButton>
      ),
   });

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  aria-label="Buscar cartões..."
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  placeholder="Buscar cartões..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     onClick={handleOpenCreate}
                     size="icon-sm"
                     tooltip="Novo Cartão"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Novo Cartão</span>
                  </Button>
               </div>
            </div>
            <ScrollArea className="rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<CreditCardRow>
                     table={table}
                     renderExpandedRow={({ row }) => (
                        <CreditCardFaturaRow creditCardId={row.original.id} />
                     )}
                  />
               </Table>
            </ScrollArea>
            <DataImportSection
               api={importApi}
               config={importConfig}
               table={table}
            />
            {table.getRowCount() === 0 && (
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <CreditCard className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum cartão de crédito</EmptyTitle>
                     <EmptyDescription>
                        Adicione um cartão de crédito para controlar seus
                        gastos.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            )}
            <DataTablePagination table={table} />
         </div>
      </div>
   );
}

function CreditCardsPage() {
   return (
      <main className="flex h-full flex-col gap-4">
         <DefaultHeader
            description="Gerencie seus cartões de crédito"
            title="Cartões de Crédito"
         />
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<CreditCardsSkeleton />}
               errorTitle="Erro ao carregar cartões"
            >
               <CreditCardsList />
            </QueryBoundary>
         </div>
      </main>
   );
}
