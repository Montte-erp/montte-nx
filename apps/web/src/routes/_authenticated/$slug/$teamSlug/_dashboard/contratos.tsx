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
import { ClipboardList, Plus } from "lucide-react";
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
import { ContratoFormSheet } from "./-contratos/contrato-form-sheet";
import {
   buildContratosColumns,
   type ContratoRow,
} from "./-contratos/contratos-columns";

const initialContratoRows: ContratoRow[] = [
   {
      id: "ctr-018",
      numero: "CTR-2026-018",
      cliente: "Acme Software Ltda",
      servico: "Suporte recorrente",
      inicioVigencia: "01/06/2026",
      fimVigencia: "31/05/2027",
      diaCobranca: "5",
      valorRecorrente: "R$ 8.900,00",
      periodicidade: "mensal",
      proximaCobranca: "05/06/2026",
      reajusteIndice: "IPCA",
      status: "ativo",
   },
   {
      id: "ctr-019",
      numero: "CTR-2026-019",
      cliente: "Boreal Serviços Digitais",
      servico: "Implantação + mensalidade",
      inicioVigencia: "15/05/2026",
      fimVigencia: "14/05/2027",
      diaCobranca: "15",
      valorRecorrente: "R$ 4.250,00",
      periodicidade: "mensal",
      proximaCobranca: "15/06/2026",
      reajusteIndice: "IGP-M",
      status: "em_assinatura",
   },
   {
      id: "ctr-020",
      numero: "CTR-2026-020",
      cliente: "Norte Coworking",
      servico: "Operação financeira",
      inicioVigencia: "01/04/2026",
      fimVigencia: "31/03/2027",
      diaCobranca: "1",
      valorRecorrente: "R$ 12.600,00",
      periodicidade: "mensal",
      proximaCobranca: "01/06/2026",
      reajusteIndice: "IPCA",
      status: "revisar_reajuste",
   },
   {
      id: "ctr-021",
      numero: "CTR-2026-021",
      cliente: "Clínica Soma",
      servico: "Pacote atendimento",
      inicioVigencia: "01/03/2026",
      fimVigencia: "28/02/2027",
      diaCobranca: "10",
      valorRecorrente: "R$ 1.780,00",
      periodicidade: "mensal",
      proximaCobranca: "10/06/2026",
      reajusteIndice: "Sem reajuste",
      status: "ativo",
   },
];

const [useContratoRows] = createLocalStorageState<ContratoRow[]>(
   "montte:demo:contratos",
   initialContratoRows,
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
   "/_authenticated/$slug/$teamSlug/_dashboard/contratos",
)({
   validateSearch: searchSchema,
   head: () => ({ meta: [{ title: "Contratos — Montte" }] }),
   component: ContratosPage,
});

function sortRows(
   rows: ContratoRow[],
   sorting: { id: string; desc: boolean }[],
) {
   const first = sorting[0];
   if (!first) return rows;
   return [...rows].sort((left, right) => {
      let result = 0;
      if (first.id === "numero")
         result = left.numero.localeCompare(right.numero);
      if (first.id === "cliente")
         result = left.cliente.localeCompare(right.cliente);
      if (first.id === "proximaCobranca")
         result = left.proximaCobranca.localeCompare(right.proximaCobranca);
      if (first.id === "status")
         result = left.status.localeCompare(right.status);
      return first.desc ? -result : result;
   });
}

function ContratosPage() {
   const [rows, setRows] = useContratoRows();
   const data = rows ?? initialContratoRows;
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
   const { openSheet } = useSheet();
   const { openAlertDialog } = useAlertDialog();
   const layout = useDataTableLayout("demo-contratos");

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
              `${row.numero} ${row.cliente} ${row.servico} ${row.status}`
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

   const handleRenew = useCallback(
      (id: string) => {
         setRows((current) =>
            (current ?? initialContratoRows).map((row) =>
               row.id === id
                  ? {
                       ...row,
                       status: "ativo",
                       fimVigencia: "31/05/2028",
                       proximaCobranca: row.proximaCobranca,
                    }
                  : row,
            ),
         );
         toast.success("Contrato renovado na demo.");
      },
      [setRows],
   );
   const handlePause = useCallback(
      (id: string) => {
         setRows((current) =>
            (current ?? initialContratoRows).map((row) =>
               row.id === id ? { ...row, status: "pausado" } : row,
            ),
         );
         toast.success("Recorrência pausada na demo.");
      },
      [setRows],
   );
   const handleDelete = useCallback(
      (id: string) => {
         openAlertDialog({
            title: "Excluir contrato",
            description: "Tem certeza que deseja excluir este contrato local?",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: () => {
               setRows((current) =>
                  (current ?? initialContratoRows).filter(
                     (row) => row.id !== id,
                  ),
               );
               toast.success("Contrato excluído da demo.");
            },
         });
      },
      [openAlertDialog, setRows],
   );

   const columns = useMemo<ColumnDef<ContratoRow>[]>(() => {
      const selectColumn: ColumnDef<ContratoRow> = {
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
         ...buildContratosColumns({
            onRenew: handleRenew,
            onPause: handlePause,
            onDelete: handleDelete,
         }),
      ];
   }, [handleDelete, handlePause, handleRenew]);

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
               <ContratoFormSheet
                  onCreate={(row) =>
                     setRows((current) => [
                        row,
                        ...(current ?? initialContratoRows),
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
                  Novo contrato
               </Button>
            }
            description="Gerencie contratos como base de recorrência: vigência, cobrança, reajuste e próxima emissão."
            title="Controle de contratos"
         />
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar contratos"
                  onChange={(event) => searchInput.onChange(event.target.value)}
                  placeholder="Buscar contratos..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="contratos-demo" />
                  <Button
                     onClick={handleCreate}
                     size="icon-sm"
                     tooltip="Novo contrato"
                     variant="outline"
                  >
                     <Plus />
                  </Button>
               </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<ContratoRow> table={table} />
               </Table>
               {table.getRowCount() === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                     <ClipboardList className="size-6" />
                     Nenhum contrato encontrado.
                  </div>
               )}
            </ScrollArea>
            <DataTablePagination table={table} />
         </div>
      </main>
   );
}
