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
import { NfeDetailSheet } from "./-nfe/nfe-detail-sheet";
import { NfeFormSheet } from "./-nfe/nfe-form-sheet";
import {
   buildNfeColumns,
   type NfeRow,
   type NfeStatus,
} from "./-nfe/nfe-columns";

const initialNfeRows: NfeRow[] = [
   {
      id: "nfe-1048",
      numero: "1048",
      serie: "1",
      modelo: "55",
      cliente: "Acme Software Ltda",
      cnpj: "12.345.678/0001-90",
      valor: "R$ 8.900,00",
      emissao: "21/05/2026",
      contrato: "CTR-2026-018",
      operacao: "Venda de licença",
      ambiente: "normal",
      chave: "35260512345678000190550010000010481000010480",
      recibo: "351000001048",
      protocolo: "135260000104800",
      retorno: "100 - Autorizado o uso da NF-e.",
      evento: "Autorização de uso homologada pela SEFAZ.",
      status: "autorizada",
   },
   {
      id: "nfe-1049",
      numero: "1049",
      serie: "1",
      modelo: "55",
      cliente: "Boreal Serviços Digitais",
      cnpj: "21.987.654/0001-10",
      valor: "R$ 4.250,00",
      emissao: "21/05/2026",
      contrato: "CTR-2026-019",
      operacao: "Venda de produto",
      ambiente: "normal",
      chave: "35260521987654000110550010000010491000010491",
      recibo: "351000001049",
      protocolo: "Sem protocolo",
      retorno: "203 - Emissor não habilitado para emissão de NF-e.",
      evento: "Lote rejeitado; corrija o cadastro fiscal antes de reenviar.",
      status: "rejeitada",
   },
   {
      id: "nfe-1050",
      numero: "1050",
      serie: "1",
      modelo: "55",
      cliente: "Clínica Soma",
      cnpj: "33.222.111/0001-44",
      valor: "R$ 1.780,00",
      emissao: "22/05/2026",
      contrato: "CTR-2026-021",
      operacao: "Venda de produto",
      ambiente: "normal",
      chave: "35260533222111000144550010000010501000010502",
      recibo: "351000001050",
      protocolo: "Sem protocolo",
      retorno: "105 - Lote em processamento.",
      evento: "Lote enviado; aguardando processamento da SEFAZ.",
      status: "processando",
   },
   {
      id: "nfe-1051",
      numero: "1051",
      serie: "1",
      modelo: "55",
      cliente: "Norte Coworking",
      cnpj: "08.111.222/0001-55",
      valor: "R$ 12.600,00",
      emissao: "22/05/2026",
      contrato: "CTR-2026-020",
      operacao: "Venda de equipamento",
      ambiente: "contingencia",
      chave: "35260508111222000155550010000010511000010513",
      recibo: "EPEC-351000001051",
      protocolo: "124260000105100",
      retorno: "124 - EPEC autorizado.",
      evento: "Emissão em contingência registrada para posterior conciliação.",
      status: "contingencia",
   },
   {
      id: "nfe-1047",
      numero: "1047",
      serie: "1",
      modelo: "55",
      cliente: "Alto Vale Comércio",
      cnpj: "41.333.222/0001-66",
      valor: "R$ 2.340,00",
      emissao: "20/05/2026",
      contrato: "PED-2026-077",
      operacao: "Venda de produto",
      ambiente: "normal",
      chave: "35260541333222000166550010000010471000010474",
      recibo: "351000001047",
      protocolo: "135260000104701",
      retorno: "101 - Cancelamento de NF-e homologado.",
      evento: "Cancelamento registrado com justificativa operacional.",
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
   head: () => ({ meta: [{ title: "NF-e - Montte" }] }),
   component: NfePage,
});

function normalizeStatus(value: string): NfeStatus {
   if (value === "validacao") return "pronta";
   if (
      value === "rascunho" ||
      value === "pronta" ||
      value === "transmitindo" ||
      value === "processando" ||
      value === "autorizada" ||
      value === "rejeitada" ||
      value === "denegada" ||
      value === "cancelada" ||
      value === "inutilizada" ||
      value === "contingencia"
   ) {
      return value;
   }
   return "rascunho";
}

function normalizeRows(rows: NfeRow[]) {
   return rows.map((row) => ({
      ...row,
      numero: row.numero.replace("NFE-", ""),
      serie: row.serie || "1",
      modelo: row.modelo || "55",
      operacao: row.operacao || "Venda de produto",
      ambiente: row.ambiente || "normal",
      chave: row.chave || "Chave pendente",
      recibo: row.recibo || "Aguardando envio",
      protocolo: row.protocolo || "Sem protocolo",
      retorno: row.retorno || "Nota aguardando transmissão.",
      evento: row.evento || "Documento criado localmente.",
      status: normalizeStatus(row.status),
   }));
}

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
      if (first.id === "ambiente")
         result = left.ambiente.localeCompare(right.ambiente);
      return first.desc ? -result : result;
   });
}

function NfePage() {
   const [rows, setRows] = useNfeRows();
   const data = useMemo(() => normalizeRows(rows ?? initialNfeRows), [rows]);
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
              `${row.numero} ${row.serie} ${row.cliente} ${row.cnpj} ${row.contrato} ${row.chave} ${row.retorno}`
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

   const updateRow = useCallback(
      (id: string, patch: Partial<NfeRow>) => {
         setRows((current) =>
            normalizeRows(current ?? initialNfeRows).map((row) =>
               row.id === id ? { ...row, ...patch } : row,
            ),
         );
      },
      [setRows],
   );

   const handleTransmit = useCallback(
      (id: string) => {
         updateRow(id, {
            status: "transmitindo",
            recibo: "351000001052",
            retorno: "103 - Lote recebido com sucesso.",
            evento:
               "NF-e assinada com certificado digital e enviada para autorização.",
         });
         toast.success("NF-e assinada e enviada para a SEFAZ na demo.");
      },
      [updateRow],
   );

   const handleConsult = useCallback(
      (id: string) => {
         const row = data.find((item) => item.id === id);
         if (row?.status === "contingencia") {
            updateRow(id, {
               status: "autorizada",
               ambiente: "normal",
               protocolo: "135260000105199",
               retorno: "100 - Autorizado o uso da NF-e após conciliação EPEC.",
               evento: "Contingência conciliada com autorização de uso.",
            });
            toast.success("EPEC conciliado na demo.");
            return;
         }
         updateRow(id, {
            status: "autorizada",
            protocolo: "135260000105200",
            retorno: "100 - Autorizado o uso da NF-e.",
            evento: "Autorização de uso homologada pela SEFAZ.",
         });
         toast.success("Consulta retornou NF-e autorizada na demo.");
      },
      [data, updateRow],
   );

   const handleDownload = useCallback(
      (id: string) => {
         const row = data.find((item) => item.id === id);
         toast.success(
            `XML/DANFE da NF-e ${row?.numero ?? id} preparado na demo.`,
         );
      },
      [data],
   );

   const handleCancel = useCallback(
      (id: string) => {
         openAlertDialog({
            title: "Cancelar NF-e",
            description:
               "O cancelamento fiscal exige justificativa e gera evento vinculado ao XML autorizado.",
            actionLabel: "Cancelar NF-e",
            cancelLabel: "Voltar",
            variant: "destructive",
            onAction: () => {
               updateRow(id, {
                  status: "cancelada",
                  protocolo: "135260000105201",
                  retorno: "101 - Cancelamento de NF-e homologado.",
                  evento:
                     "Cancelamento registrado com justificativa operacional.",
               });
               toast.success("Cancelamento homologado na demo.");
            },
         });
      },
      [openAlertDialog, updateRow],
   );

   const handleDelete = useCallback(
      (id: string) => {
         openAlertDialog({
            title: "Excluir NF-e local",
            description:
               "Tem certeza que deseja excluir este registro da demo?",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: () => {
               setRows((current) =>
                  normalizeRows(current ?? initialNfeRows).filter(
                     (row) => row.id !== id,
                  ),
               );
               toast.success("NF-e excluída da demo.");
            },
         });
      },
      [openAlertDialog, setRows],
   );

   const handleOpen = useCallback(
      (row: NfeRow) => {
         openSheet({
            renderChildren: () => (
               <NfeDetailSheet
                  onConsult={handleConsult}
                  onDownload={handleDownload}
                  row={row}
               />
            ),
         });
      },
      [handleConsult, handleDownload, openSheet],
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
            onOpen: handleOpen,
            onTransmit: handleTransmit,
            onConsult: handleConsult,
            onCancel: handleCancel,
            onDownload: handleDownload,
            onDelete: handleDelete,
         }),
      ];
   }, [
      handleCancel,
      handleConsult,
      handleDelete,
      handleDownload,
      handleOpen,
      handleTransmit,
   ]);

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
                  setRows((current) => [
                     row,
                     ...normalizeRows(current ?? initialNfeRows),
                  ])
               }
            />
         ),
      });
   }, [openSheet, setRows]);

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Emita com certificado digital já conectado e acompanhe retorno da SEFAZ sem operação fiscal manual."
            title="NF-e"
         />
         <div className="flex flex-1 min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar NF-e"
                  onChange={(event) => searchInput.onChange(event.target.value)}
                  placeholder="Buscar por número, cliente, chave ou retorno..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="nfe-demo" />
                  <Button
                     onClick={handleCreate}
                     size="icon-sm"
                     tooltip="Emitir NF-e"
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
