import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { toast } from "@packages/ui/hooks/use-toast";
import { createFileRoute } from "@tanstack/react-router";
import {
   type ColumnOrderState,
   getCoreRowModel,
   type ColumnPinningState,
   type OnChangeFn,
   useReactTable,
   type ColumnDef,
} from "@tanstack/react-table";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { Package, Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { z } from "zod";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { ExportButton } from "@/components/export-button/export-button";
import { useCredenza } from "@/hooks/use-credenza";
import { useSheet } from "@/hooks/use-sheet";
import { DefaultHeader } from "../-layout/default-header";
import { ProdutoFormSheet } from "./-produtos/produto-form-sheet";
import { ProdutoHistoryCredenza } from "./-produtos/produto-history-credenza";
import {
   ProdutoMovementSheet,
   type ProdutoMovementFormValues,
} from "./-produtos/produto-movement-sheet";
import {
   buildProdutosColumns,
   type ProdutoRow,
} from "./-produtos/produtos-columns";

const initialProdutoRows: ProdutoRow[] = [
   {
      id: "prd-1001",
      sku: "SKU-1001",
      nome: "Cápsula de café",
      saldo: 84,
      minimo: 20,
      custoUnitario: 1.9,
      precoVenda: 3.5,
      categoryId: "",
      categoryName: "Compras de estoque",
      tagId: "",
      tagName: "Operação",
      movements: [
         {
            id: "mov-1001-1",
            type: "entrada",
            quantityUnits: 144,
            previousQuantityUnits: 0,
            resultingQuantityUnits: 144,
            unitCost: 1.9,
            totalAmount: 273.6,
            reason: "compra",
            categoryId: "",
            categoryName: "Compras de estoque",
            tagId: "",
            tagName: "Operação",
            occurredAt: "2026-05-18",
            note: "12 caixas com 12 unidades.",
            createsFinancialEntry: true,
         },
         {
            id: "mov-1001-2",
            type: "saida",
            quantityUnits: -60,
            previousQuantityUnits: 144,
            resultingQuantityUnits: 84,
            unitCost: 3.5,
            totalAmount: 210,
            reason: "venda",
            categoryId: "",
            categoryName: "Vendas de Produtos",
            tagId: "",
            tagName: "Operação",
            occurredAt: "2026-05-20",
            note: "",
            createsFinancialEntry: true,
         },
      ],
   },
   {
      id: "prd-1042",
      sku: "SKU-1042",
      nome: "Filtro de papel",
      saldo: 8,
      minimo: 10,
      custoUnitario: 0.45,
      precoVenda: 0.9,
      categoryId: "",
      categoryName: "Compras de estoque",
      tagId: "",
      tagName: "Operação",
      movements: [],
   },
   {
      id: "prd-2088",
      sku: "SKU-2088",
      nome: "Copo descartável",
      saldo: 320,
      minimo: 80,
      custoUnitario: 0.18,
      precoVenda: 0.35,
      categoryId: "",
      categoryName: "Materiais de consumo",
      tagId: "",
      tagName: "Eventos",
      movements: [],
   },
   {
      id: "prd-3030",
      sku: "SKU-3030",
      nome: "Etiqueta térmica",
      saldo: 14,
      minimo: 12,
      custoUnitario: 0.12,
      precoVenda: 0.25,
      categoryId: "",
      categoryName: "Expedição",
      tagId: "",
      tagName: "Expedição",
      movements: [],
   },
   {
      id: "prd-4040",
      sku: "SKU-4040",
      nome: "Camiseta evento",
      saldo: 5,
      minimo: 8,
      custoUnitario: 32,
      precoVenda: 59,
      categoryId: "",
      categoryName: "Marketing",
      tagId: "",
      tagName: "Marketing",
      movements: [],
   },
];

const [useProdutoRows] = createLocalStorageState<ProdutoRow[]>(
   "montte:demo:produtos:v2",
   initialProdutoRows,
);

const searchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   search: z.string().catch("").default(""),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().min(1).max(100).catch(20).default(20),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/produtos",
)({
   validateSearch: searchSchema,
   head: () => ({ meta: [{ title: "Produtos e estoque — Montte" }] }),
   component: ProdutosPage,
});

function sortRows(
   rows: ProdutoRow[],
   sorting: { id: string; desc: boolean }[],
) {
   const first = sorting[0];
   if (!first) return rows;
   return [...rows].sort((left, right) => {
      let result = 0;
      if (first.id === "sku") result = left.sku.localeCompare(right.sku);
      if (first.id === "nome") result = left.nome.localeCompare(right.nome);
      if (first.id === "categoryName")
         result = left.categoryName.localeCompare(right.categoryName);
      if (first.id === "tagName")
         result = left.tagName.localeCompare(right.tagName);
      if (first.id === "saldo") result = left.saldo - right.saldo;
      if (first.id === "minimo") result = left.minimo - right.minimo;
      if (first.id === "custoUnitario")
         result = left.custoUnitario - right.custoUnitario;
      if (first.id === "precoVenda")
         result = left.precoVenda - right.precoVenda;
      return first.desc ? -result : result;
   });
}

function normalizeProdutoColumnOrder(
   order: ColumnOrderState,
   allColumnIds: ColumnOrderState,
) {
   if (order.length === 0) return order;
   const next = order.filter(
      (id) => id !== "__actions" && allColumnIds.includes(id),
   );
   const missing = allColumnIds.filter(
      (id) => id !== "__actions" && !next.includes(id),
   );
   return [...next, ...missing, "__actions"];
}

function normalizeProdutoColumnPinning(
   pinning: ColumnPinningState,
): ColumnPinningState {
   const left = (pinning.left ?? []).filter((id) => id !== "__actions");
   const right = (pinning.right ?? []).filter((id) => id !== "__actions");
   return { left, right: [...right, "__actions"] };
}

function getProdutoColumnId(column: ColumnDef<ProdutoRow>) {
   if (column.id) return column.id;
   if ("accessorKey" in column && typeof column.accessorKey === "string") {
      return column.accessorKey;
   }
   return undefined;
}

function isDefined(value: string | undefined): value is string {
   return typeof value === "string";
}

function ProdutosPage() {
   const [rows, setRows] = useProdutoRows();
   const data = normalizeProdutoRows(rows ?? initialProdutoRows);
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
   const { openSheet } = useSheet();
   const { openCredenza } = useCredenza();
   const {
      state: layoutState,
      onColumnSizingChange,
      onColumnOrderChange,
      onColumnVisibilityChange,
      onColumnPinningChange,
   } = useDataTableLayout("demo-produtos");
   const columnPinning = useMemo(
      () => normalizeProdutoColumnPinning(layoutState.columnPinning),
      [layoutState.columnPinning],
   );

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });
   const filteredRows = useMemo(() => {
      const term = search.trim().toLocaleLowerCase();
      const filtered = term
         ? data.filter((row) =>
              `${row.sku} ${row.nome} ${row.categoryName} ${row.tagName}`
                 .toLocaleLowerCase()
                 .includes(term),
           )
         : data;
      return sortRows(filtered, sorting);
   }, [data, search, sorting]);
   const paginatedRows = useMemo(
      () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
      [filteredRows, page, pageSize],
   );

   const registerMovement = useCallback(
      (productId: string, value: ProdutoMovementFormValues) => {
         let created = false;
         setRows((current) =>
            (current ?? initialProdutoRows).map((row) => {
               if (row.id !== productId) return row;

               const quantityUnits = movementQuantity(row.saldo, value);
               const nextSaldo = row.saldo + quantityUnits;
               if (nextSaldo < 0) {
                  toast.error("Saldo insuficiente para registrar esta saída.");
                  return row;
               }

               created = true;
               return {
                  ...row,
                  saldo: nextSaldo,
                  custoUnitario:
                     value.type === "entrada"
                        ? value.unitCost
                        : row.custoUnitario,
                  movements: [
                     {
                        id: crypto.randomUUID(),
                        type: value.type,
                        quantityUnits,
                        previousQuantityUnits: row.saldo,
                        resultingQuantityUnits: nextSaldo,
                        unitCost:
                           value.type === "ajuste"
                              ? row.custoUnitario
                              : value.unitCost,
                        totalAmount:
                           value.type === "ajuste" ? 0 : value.totalAmount,
                        reason: value.reason.trim(),
                        categoryId: value.categoryId,
                        categoryName: value.categoryName,
                        tagId: value.tagId,
                        tagName: value.tagName,
                        occurredAt: value.occurredAt,
                        note: value.note.trim(),
                        createsFinancialEntry:
                           value.type === "ajuste"
                              ? false
                              : value.createsFinancialEntry,
                     },
                     ...(row.movements ?? []),
                  ],
               };
            }),
         );
         return created;
      },
      [setRows],
   );
   const handleOpenMovement = useCallback(
      (id: string) => {
         const product = data.find((row) => row.id === id);
         if (!product) return;

         openSheet({
            renderChildren: () => (
               <ProdutoMovementSheet
                  onCreate={(value) => registerMovement(product.id, value)}
                  product={product}
               />
            ),
         });
      },
      [data, openSheet, registerMovement],
   );
   const handleOpenHistory = useCallback(
      (id: string) => {
         const product = data.find((row) => row.id === id);
         if (!product) return;

         openCredenza({
            className: "sm:max-w-2xl",
            renderChildren: () => <ProdutoHistoryCredenza product={product} />,
         });
      },
      [data, openCredenza],
   );

   const columns = useMemo<ColumnDef<ProdutoRow>[]>(() => {
      const selectColumn: ColumnDef<ProdutoRow> = {
         id: "__select",
         size: 40,
         enableSorting: false,
         enableHiding: false,
         header: ({ table }) => (
            <Checkbox
               aria-label="Selecionar todas"
               checked={
                  table.getIsAllPageRowsSelected()
                     ? true
                     : table.getIsSomePageRowsSelected()
                       ? "indeterminate"
                       : false
               }
               onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(!!value)
               }
            />
         ),
         cell: ({ row }) => (
            <Checkbox
               aria-label="Selecionar linha"
               checked={row.getIsSelected()}
               onCheckedChange={(value) => row.toggleSelected(!!value)}
            />
         ),
      };
      return [
         selectColumn,
         ...buildProdutosColumns({
            onOpenHistory: handleOpenHistory,
            onRegisterMovement: handleOpenMovement,
         }),
      ];
   }, [handleOpenHistory, handleOpenMovement]);
   const columnIds = useMemo(
      () => columns.map(getProdutoColumnId).filter(isDefined),
      [columns],
   );
   const columnOrder = useMemo(
      () => normalizeProdutoColumnOrder(layoutState.columnOrder, columnIds),
      [layoutState.columnOrder, columnIds],
   );
   const handleColumnOrderChange = useCallback<OnChangeFn<ColumnOrderState>>(
      (updater) => {
         onColumnOrderChange((prev) =>
            normalizeProdutoColumnOrder(
               typeof updater === "function" ? updater(prev) : updater,
               columnIds,
            ),
         );
      },
      [onColumnOrderChange, columnIds],
   );
   const handleColumnPinningChange = useCallback<
      OnChangeFn<ColumnPinningState>
   >(
      (updater) => {
         onColumnPinningChange((prev) =>
            normalizeProdutoColumnPinning(
               typeof updater === "function" ? updater(prev) : updater,
            ),
         );
      },
      [onColumnPinningChange],
   );

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
      onUpdate: (next) =>
         navigate({ search: (prev) => ({ ...prev, ...next }), replace: true }),
      totalRows: filteredRows.length,
   });
   const table = useReactTable({
      data: paginatedRows,
      columns,
      getRowId: (row) => row.id,
      pageCount: urlState.pageCount,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      state: { ...urlState.state, ...layoutState, columnOrder, columnPinning },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onColumnSizingChange,
      onColumnOrderChange: handleColumnOrderChange,
      onColumnVisibilityChange,
      onColumnPinningChange: handleColumnPinningChange,
      getCoreRowModel: getCoreRowModel(),
   });
   const handleCreate = useCallback(
      () =>
         openSheet({
            renderChildren: () => (
               <ProdutoFormSheet
                  onCreate={(row) =>
                     setRows((current) => [
                        row,
                        ...(current ?? initialProdutoRows),
                     ])
                  }
               />
            ),
         }),
      [openSheet, setRows],
   );

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Controle produtos físicos por SKU, saldo, custo, preço de venda e histórico de movimentações."
            title="Produtos e estoque"
         />
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar produtos"
                  onChange={(event) => searchInput.onChange(event.target.value)}
                  placeholder="Buscar produtos..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="produtos-demo" />
                  <Button
                     onClick={handleCreate}
                     size="icon-sm"
                     tooltip="Novo produto"
                     variant="outline"
                  >
                     <Plus />
                  </Button>
               </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<ProdutoRow> table={table} />
               </Table>
               {table.getRowCount() === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                     <Package className="size-6" />
                     Nenhum produto encontrado.
                  </div>
               )}
            </ScrollArea>
            <DataTablePagination table={table} />
         </div>
      </main>
   );
}

function movementQuantity(
   currentStock: number,
   value: ProdutoMovementFormValues,
) {
   if (value.type === "entrada") return value.quantityUnits;
   if (value.type === "saida") return -value.quantityUnits;
   return value.quantityUnits - currentStock;
}

function normalizeProdutoRows(
   rows: Array<ProdutoRow & { centroCusto?: string }>,
) {
   return rows.map((row) => ({
      ...row,
      categoryId: row.categoryId ?? "",
      categoryName: row.categoryName ?? "",
      tagId: row.tagId ?? "",
      tagName: row.tagName ?? row.centroCusto ?? "",
      custoUnitario: row.custoUnitario ?? 0,
      precoVenda: row.precoVenda ?? 0,
      movements: (row.movements ?? []).map((movement) => ({
         ...movement,
         categoryId: movement.categoryId ?? "",
         categoryName: movement.categoryName ?? "",
         tagId: movement.tagId ?? "",
         tagName: movement.tagName ?? "",
      })),
   }));
}
