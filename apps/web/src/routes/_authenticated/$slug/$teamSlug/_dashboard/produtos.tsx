import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { toast } from "@packages/ui/hooks/use-toast";
import { createFileRoute } from "@tanstack/react-router";
import {
   getCoreRowModel,
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
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { DefaultHeader } from "../-layout/default-header";
import { ProdutoFormSheet } from "./-produtos/produto-form-sheet";
import {
   buildProdutosColumns,
   type ProdutoRow,
} from "./-produtos/produtos-columns";

const initialProdutoRows: ProdutoRow[] = [
   {
      id: "prd-1001",
      sku: "SKU-1001",
      nome: "Licença anual Montte Pro",
      saldo: 84,
      reservado: 12,
      minimo: 20,
      deposito: "Principal",
   },
   {
      id: "prd-1042",
      sku: "SKU-1042",
      nome: "Kit implantação assistida",
      saldo: 8,
      reservado: 4,
      minimo: 10,
      deposito: "Serviços",
   },
   {
      id: "prd-2088",
      sku: "SKU-2088",
      nome: "Token fiscal avulso",
      saldo: 320,
      reservado: 40,
      minimo: 80,
      deposito: "Fiscal",
   },
   {
      id: "prd-3030",
      sku: "SKU-3030",
      nome: "Pacote suporte premium",
      saldo: 14,
      reservado: 14,
      minimo: 12,
      deposito: "Serviços",
   },
   {
      id: "prd-4040",
      sku: "SKU-4040",
      nome: "Módulo integração ERP",
      saldo: 5,
      reservado: 1,
      minimo: 8,
      deposito: "Principal",
   },
];

const [useProdutoRows] = createLocalStorageState<ProdutoRow[]>(
   "montte:demo:produtos",
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
      if (first.id === "deposito")
         result = left.deposito.localeCompare(right.deposito);
      if (first.id === "saldo") result = left.saldo - right.saldo;
      if (first.id === "reservado") result = left.reservado - right.reservado;
      if (first.id === "minimo") result = left.minimo - right.minimo;
      return first.desc ? -result : result;
   });
}

function ProdutosPage() {
   const [rows, setRows] = useProdutoRows();
   const data = rows ?? initialProdutoRows;
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
   const { openSheet } = useSheet();
   const { openAlertDialog } = useAlertDialog();
   const layout = useDataTableLayout("demo-produtos");

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
              `${row.sku} ${row.nome} ${row.deposito}`
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

   const handleEntry = useCallback(
      (id: string) => {
         setRows((current) =>
            (current ?? initialProdutoRows).map((row) =>
               row.id === id ? { ...row, saldo: row.saldo + 10 } : row,
            ),
         );
         toast.success("Entrada de 10 unidades registrada na demo.");
      },
      [setRows],
   );
   const handleReserve = useCallback(
      (id: string) => {
         setRows((current) =>
            (current ?? initialProdutoRows).map((row) =>
               row.id === id
                  ? {
                       ...row,
                       reservado: Math.min(row.saldo, row.reservado + 1),
                    }
                  : row,
            ),
         );
         toast.success("Reserva de 1 unidade registrada na demo.");
      },
      [setRows],
   );
   const handleDelete = useCallback(
      (id: string) => {
         openAlertDialog({
            title: "Excluir produto",
            description: "Tem certeza que deseja excluir este produto local?",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: () => {
               setRows((current) =>
                  (current ?? initialProdutoRows).filter(
                     (row) => row.id !== id,
                  ),
               );
               toast.success("Produto excluído da demo.");
            },
         });
      },
      [openAlertDialog, setRows],
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
            onEntry: handleEntry,
            onReserve: handleReserve,
            onDelete: handleDelete,
         }),
      ];
   }, [handleDelete, handleEntry, handleReserve]);

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
      state: { ...urlState.state, ...layout.state },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
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
            actions={
               <Button onClick={handleCreate}>
                  <Plus />
                  Novo produto
               </Button>
            }
            description="Controle produtos locais por SKU, depósito, saldo, reserva e estoque mínimo."
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
