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
import { FileCheck2, Plus } from "lucide-react";
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
import { NfeFormSheet } from "./-nfe/nfe-form-sheet";
import {
   buildNfeColumns,
   type NfeRow,
   type NfeStatus,
} from "./-nfe/nfe-columns";

const initialNfeRows: NfeRow[] = [
   {
      id: "nfe-1048",
      numero: "NFE-1048",
      cliente: "Acme Software Ltda",
      cnpj: "12.345.678/0001-90",
      valor: "R$ 8.900,00",
      emissao: "21/05/2026",
      contrato: "CTR-2026-018",
      status: "autorizada",
   },
   {
      id: "nfe-1049",
      numero: "NFE-1049",
      cliente: "Boreal Serviços Digitais",
      cnpj: "21.987.654/0001-10",
      valor: "R$ 4.250,00",
      emissao: "21/05/2026",
      contrato: "CTR-2026-019",
      status: "validacao",
   },
   {
      id: "nfe-1050",
      numero: "NFE-1050",
      cliente: "Clínica Soma",
      cnpj: "33.222.111/0001-44",
      valor: "R$ 1.780,00",
      emissao: "22/05/2026",
      contrato: "CTR-2026-021",
      status: "rascunho",
   },
   {
      id: "nfe-1051",
      numero: "NFE-1051",
      cliente: "Norte Coworking",
      cnpj: "08.111.222/0001-55",
      valor: "R$ 12.600,00",
      emissao: "22/05/2026",
      contrato: "CTR-2026-020",
      status: "cancelada",
   },
];

const [useNfeRows] = createLocalStorageState<NfeRow[]>(
   "montte:demo:nfe",
   initialNfeRows,
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
   "/_authenticated/$slug/$teamSlug/_dashboard/nfe",
)({
   validateSearch: searchSchema,
   head: () => ({ meta: [{ title: "NF-e — Montte" }] }),
   component: NfePage,
});

function sortRows(rows: NfeRow[], sorting: { id: string; desc: boolean }[]) {
   const first = sorting[0];
   if (!first) return rows;
   return [...rows].sort((left, right) => {
      let result = 0;
      if (first.id === "numero")
         result = left.numero.localeCompare(right.numero);
      if (first.id === "cliente")
         result = left.cliente.localeCompare(right.cliente);
      if (first.id === "status")
         result = left.status.localeCompare(right.status);
      if (first.id === "emissao")
         result = left.emissao.localeCompare(right.emissao);
      return first.desc ? -result : result;
   });
}

function NfePage() {
   const [rows, setRows] = useNfeRows();
   const data = rows ?? initialNfeRows;
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
   const { openSheet } = useSheet();
   const { openAlertDialog } = useAlertDialog();
   const layout = useDataTableLayout("demo-nfe");

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
              `${row.numero} ${row.cliente} ${row.cnpj} ${row.contrato}`
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

   const updateStatus = useCallback(
      (id: string, status: NfeStatus) => {
         setRows((current) =>
            (current ?? initialNfeRows).map((row) =>
               row.id === id ? { ...row, status } : row,
            ),
         );
         toast.success(
            status === "autorizada"
               ? "NF-e autorizada na demo."
               : "NF-e cancelada na demo.",
         );
      },
      [setRows],
   );

   const handleDelete = useCallback(
      (id: string) => {
         openAlertDialog({
            title: "Excluir NF-e mockada",
            description: "Tem certeza que deseja excluir esta NF-e local?",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: () => {
               setRows((current) =>
                  (current ?? initialNfeRows).filter((row) => row.id !== id),
               );
               toast.success("NF-e excluída da demo.");
            },
         });
      },
      [openAlertDialog, setRows],
   );

   const columns = useMemo<ColumnDef<NfeRow>[]>(() => {
      const selectColumn: ColumnDef<NfeRow> = {
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
         ...buildNfeColumns({
            onAuthorize: (id) => updateStatus(id, "autorizada"),
            onCancel: (id) => updateStatus(id, "cancelada"),
            onDelete: handleDelete,
         }),
      ];
   }, [handleDelete, updateStatus]);

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

   const handleCreate = useCallback(() => {
      openSheet({
         renderChildren: () => (
            <NfeFormSheet
               onCreate={(row) =>
                  setRows((current) => [row, ...(current ?? initialNfeRows)])
               }
            />
         ),
      });
   }, [openSheet, setRows]);

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus />
                  Nova NF-e
               </Button>
            }
            description="Emita notas mockadas, acompanhe validação fiscal e vincule documentos aos contratos recorrentes."
            title="Emissão de NF-e"
         />
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar NF-e"
                  onChange={(event) => searchInput.onChange(event.target.value)}
                  placeholder="Buscar NF-e..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="nfe-demo" />
                  <Button
                     onClick={handleCreate}
                     size="icon-sm"
                     tooltip="Nova NF-e"
                     variant="outline"
                  >
                     <Plus />
                  </Button>
               </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<NfeRow> table={table} />
               </Table>
               {table.getRowCount() === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                     <FileCheck2 className="size-6" />
                     Nenhuma NF-e encontrada.
                  </div>
               )}
            </ScrollArea>
            <DataTablePagination table={table} />
         </div>
      </main>
   );
}
