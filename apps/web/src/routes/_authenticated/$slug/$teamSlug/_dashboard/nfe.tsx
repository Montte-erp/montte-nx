import { useSuspenseQuery } from "@tanstack/react-query";
import {
   getCoreRowModel,
   getExpandedRowModel,
   getGroupedRowModel,
   useReactTable,
   type ColumnDef,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import {
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Table } from "@packages/ui/components/table";
import { toast } from "@packages/ui/hooks/use-toast";
import dayjs from "dayjs";
import { Copy, Download, Eye, FileText, Plus, ReceiptText } from "lucide-react";
import { z } from "zod";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableFilterChips } from "@/blocks/data-table/data-table-filter-chips";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { QueryBoundary } from "@/components/query-boundary";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc, type Outputs } from "@/integrations/orpc/client";
import { DefaultHeader } from "../-layout/default-header";
import { useCallback, useEffect, useMemo, useRef } from "react";

type NfeRow = Outputs["fiscal"]["listNfe"]["items"][number];

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/nfe",
)({
   validateSearch: z.object({
      sorting: z
         .array(z.object({ id: z.string(), desc: z.boolean() }))
         .catch([])
         .default([]),
      columnFilters: z
         .array(z.object({ id: z.string(), value: z.unknown() }))
         .catch([])
         .default([]),
      page: z.number().int().min(1).catch(1).default(1),
      pageSize: z.number().int().min(1).max(100).catch(20).default(20),
      grouping: z.array(z.string()).catch(["status"]).default(["status"]),
      search: z.string().catch("").default(""),
   }),
   pendingMs: 300,
   pendingComponent: NfeSkeleton,
   head: () => ({ meta: [{ title: "NF-e — Montte" }] }),
   component: NfePage,
});

const nfeSortIdSchema = z.enum([
   "accessKey",
   "issuerName",
   "issuedAt",
   "number",
   "recipientName",
   "status",
   "totalAmountCents",
   "updatedAt",
]);

const nfeStatusLabels = {
   authorized: "Autorizada",
   cancelled: "Cancelada",
   received: "Recebida",
} as const;

const skeletonColumns = buildNfeColumns();

function formatMoneyFromCents(value: number) {
   return format(of(String(value / 100), "BRL"), "pt-BR");
}

function normalizeSorting(sorting: Array<{ id: string; desc: boolean }>) {
   return sorting.flatMap((rule) => {
      const result = nfeSortIdSchema.safeParse(rule.id);
      return result.success ? [{ id: result.data, desc: rule.desc }] : [];
   });
}

function buildNfeColumns(): ColumnDef<NfeRow>[] {
   return [
      {
         accessorKey: "number",
         header: "Número",
         size: 140,
         meta: { label: "Número" },
         cell: ({ row }) => (
            <span className="font-medium">
               {row.original.number}/{row.original.series}
            </span>
         ),
      },
      {
         accessorKey: "issuerName",
         header: "Emitente",
         size: 260,
         meta: { label: "Emitente" },
      },
      {
         accessorKey: "recipientName",
         header: "Destinatário",
         size: 260,
         meta: { label: "Destinatário" },
         cell: ({ row }) => row.original.recipientName || "—",
      },
      {
         accessorKey: "totalAmountCents",
         header: "Valor",
         size: 140,
         meta: { label: "Valor" },
         cell: ({ row }) => formatMoneyFromCents(row.original.totalAmountCents),
      },
      {
         accessorKey: "issuedAt",
         header: "Emissão",
         size: 140,
         meta: { label: "Emissão" },
         cell: ({ row }) =>
            row.original.issuedAt
               ? dayjs(row.original.issuedAt).format("DD/MM/YYYY")
               : "—",
      },
      {
         accessorKey: "status",
         header: "Status",
         size: 140,
         meta: {
            label: "Status",
            formatGroupLabel: (value) =>
               nfeStatusLabels[String(value) as keyof typeof nfeStatusLabels] ??
               String(value || "Sem status"),
         },
         cell: ({ row }) => (
            <Badge variant="outline">{row.original.statusLabel}</Badge>
         ),
      },
      {
         accessorKey: "accessKey",
         header: "Chave de acesso",
         size: 320,
         meta: { label: "Chave de acesso" },
         cell: ({ row }) => (
            <span className="font-mono text-xs text-muted-foreground">
               {row.original.accessKey}
            </span>
         ),
      },
   ];
}

function NfeDetailsCredenza({ document }: { document: NfeRow }) {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               NF-e {document.number}/{document.series}
            </CredenzaTitle>
            <CredenzaDescription>
               {document.issuerName} →{" "}
               {document.recipientName || "Destinatário não informado"}
            </CredenzaDescription>
         </CredenzaHeader>
         <div className="grid gap-3 rounded-md border bg-muted/20 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
               <span className="text-muted-foreground">Status</span>
               <Badge variant="outline">{document.statusLabel}</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
               <span className="text-muted-foreground">Valor</span>
               <span className="font-medium">
                  {formatMoneyFromCents(document.totalAmountCents)}
               </span>
            </div>
            <div className="flex items-center justify-between gap-4">
               <span className="text-muted-foreground">Emissão</span>
               <span>
                  {document.issuedAt
                     ? dayjs(document.issuedAt).format("DD/MM/YYYY")
                     : "—"}
               </span>
            </div>
            <div className="grid gap-1">
               <span className="text-muted-foreground">Chave de acesso</span>
               <code className="break-all rounded bg-background px-2 py-1 font-mono text-xs">
                  {document.accessKey}
               </code>
            </div>
         </div>
         <CredenzaFooter>
            <Button
               onClick={() => {
                  void navigator.clipboard.writeText(document.accessKey);
                  toast.success("Chave de acesso copiada.");
               }}
               type="button"
               variant="outline"
            >
               <Copy />
               Copiar chave
            </Button>
         </CredenzaFooter>
      </>
   );
}

function IssueNfeCredenza({ onConfigure }: { onConfigure: () => void }) {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Emitir NF-e</CredenzaTitle>
            <CredenzaDescription>
               A emissão real será feita pelo portal jacobina-saatri. Configure
               o portal e use esta ação para iniciar novas emissões assim que o
               conector de emissão estiver ativo.
            </CredenzaDescription>
         </CredenzaHeader>
         <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
            O Montte já está preparando a área de emissão. A integração real de
            envio, XML e DANFE depende do conector fiscal do portal.
         </div>
         <CredenzaFooter>
            <Button onClick={onConfigure} type="button" variant="outline">
               Configurar portal
            </Button>
            <Button
               onClick={() =>
                  toast.info(
                     "Emissão de NF-e em Early Access. O conector real ainda será ativado.",
                  )
               }
               type="button"
            >
               <FileText />
               Iniciar emissão
            </Button>
         </CredenzaFooter>
      </>
   );
}

function ConfigurePortalCredenza({ onConfigure }: { onConfigure: () => void }) {
   const { closeCredenza } = useCredenza();
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Configure o portal da NF-e</CredenzaTitle>
            <CredenzaDescription>
               Para consultar ou emitir NF-e, configure o portal jacobina-saatri
               com login e senha de produção.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaFooter>
            <Button
               onClick={() => {
                  closeCredenza();
                  onConfigure();
               }}
            >
               Configurar portal
            </Button>
         </CredenzaFooter>
      </>
   );
}

function NfeContent() {
   const navigate = Route.useNavigate();
   const { slug, teamSlug } = Route.useParams();
   const { closeCredenza, openCredenza } = useCredenza();
   const didOpenSetup = useRef(false);
   const { sorting, columnFilters, search, page, pageSize, grouping } =
      Route.useSearch();
   const layout = useDataTableLayout("fiscal-nfe");
   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });
   const input = {
      search,
      page,
      pageSize,
      sorting: normalizeSorting(sorting),
   };
   const { data: settings } = useSuspenseQuery(
      orpc.fiscal.getFiscalSettings.queryOptions({}),
   );
   const { data } = useSuspenseQuery(
      orpc.fiscal.listNfe.queryOptions({ input }),
   );
   const ready = Boolean(
      settings.enabled &&
      settings.dfeProvider &&
      settings.dfeUsername &&
      settings.hasDfePassword,
   );

   const openSettings = useCallback(() => {
      closeCredenza();
      navigate({
         params: { slug, teamSlug },
         to: "/$slug/$teamSlug/settings/project/modules/nfe",
      });
   }, [closeCredenza, navigate, slug, teamSlug]);

   useEffect(() => {
      if (ready || didOpenSetup.current) return;
      didOpenSetup.current = true;
      openCredenza({
         className: "sm:max-w-md",
         renderChildren: () => (
            <ConfigurePortalCredenza onConfigure={openSettings} />
         ),
      });
      return closeCredenza;
   }, [closeCredenza, openCredenza, openSettings, ready]);

   const handleIssueNfe = useCallback(() => {
      openCredenza({
         className: "sm:max-w-lg",
         renderChildren: () => <IssueNfeCredenza onConfigure={openSettings} />,
      });
   }, [openCredenza, openSettings]);

   const columns = useMemo<ColumnDef<NfeRow>[]>(() => {
      const selectColumn: ColumnDef<NfeRow> = {
         id: "__select",
         size: 40,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true },
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
                  table.toggleAllPageRowsSelected(Boolean(value))
               }
            />
         ),
         cell: ({ row }) => (
            <Checkbox
               aria-label="Selecionar NF-e"
               checked={row.getIsSelected()}
               disabled={!row.getCanSelect()}
               onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            />
         ),
      };
      const actionsColumn: ColumnDef<NfeRow> = {
         id: "__actions",
         size: 132,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true },
         cell: ({ row }) => (
            <div className="flex justify-start gap-2">
               <Button
                  onClick={() =>
                     openCredenza({
                        className: "sm:max-w-xl",
                        renderChildren: () => (
                           <NfeDetailsCredenza document={row.original} />
                        ),
                     })
                  }
                  size="icon-sm"
                  tooltip="Visualizar"
                  type="button"
                  variant="ghost"
               >
                  <Eye />
                  <span className="sr-only">Visualizar</span>
               </Button>
               <Button
                  onClick={() => {
                     void navigator.clipboard.writeText(row.original.accessKey);
                     toast.success("Chave de acesso copiada.");
                  }}
                  size="icon-sm"
                  tooltip="Copiar chave"
                  type="button"
                  variant="ghost"
               >
                  <Copy />
                  <span className="sr-only">Copiar chave</span>
               </Button>
               <Button
                  onClick={() =>
                     toast.info(
                        "Download de XML/DANFE será liberado com a consulta real do portal.",
                     )
                  }
                  size="icon-sm"
                  tooltip="Baixar XML/DANFE"
                  type="button"
                  variant="ghost"
               >
                  <Download />
                  <span className="sr-only">Baixar XML/DANFE</span>
               </Button>
            </div>
         ),
      };
      return [selectColumn, ...buildNfeColumns(), actionsColumn];
   }, [openCredenza]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize, grouping },
      totalRows: data.total,
      onUpdate: (next) =>
         navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
         }),
   });
   const table = useReactTable({
      data: data.items,
      columns,
      getRowId: (row) => row.id,
      rowCount: data.total,
      pageCount: urlState.pageCount,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      groupedColumnMode: false,
      state: { ...urlState.state, ...layout.state, expanded: true },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onGroupingChange: urlState.onGroupingChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      getCoreRowModel: getCoreRowModel(),
      getGroupedRowModel: getGroupedRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
   });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedNfe = selectedRows.map((row) => row.original);
   useTableBulkActions({
      selectedCount: selectedNfe.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <>
            <SelectionActionButton
               icon={<Copy className="size-4" />}
               onClick={() => {
                  void navigator.clipboard.writeText(
                     selectedNfe.map((row) => row.accessKey).join("\n"),
                  );
                  toast.success(
                     `${selectedNfe.length} ${selectedNfe.length === 1 ? "chave copiada" : "chaves copiadas"}.`,
                  );
               }}
            >
               Copiar chaves
            </SelectionActionButton>
            <SelectionActionButton
               icon={<Download className="size-4" />}
               onClick={() =>
                  toast.info(
                     "Download em lote de XML/DANFE será liberado com a consulta real do portal.",
                  )
               }
            >
               Baixar XML/DANFE
            </SelectionActionButton>
         </>
      ),
   });

   return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
         <div className="flex flex-wrap items-center justify-between gap-2">
            <SearchInput
               aria-label="Buscar NF-e"
               className="max-w-sm"
               onChange={(event) => searchInput.onChange(event.target.value)}
               placeholder="Buscar NF-e..."
               value={searchInput.value}
            />
            <div className="flex flex-wrap items-center gap-2">
               <DataTableColumnVisibility table={table} />
               <Button
                  onClick={handleIssueNfe}
                  size="icon-sm"
                  tooltip="Emitir NF-e"
                  type="button"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Emitir NF-e</span>
               </Button>
            </div>
         </div>
         <DataTableFilterChips table={table} />
         <ScrollArea className="min-h-0 flex-1 rounded-md border bg-card">
            <Table>
               <DataTableHeader table={table} />
               <DataTableBody<NfeRow>
                  renderGroupLabel={({ row }) => {
                     const status = String(row.groupingValue || "received");
                     const label =
                        nfeStatusLabels[
                           status as keyof typeof nfeStatusLabels
                        ] ?? "Sem status";
                     const count = row.subRows.length;
                     return (
                        <div className="flex items-center gap-2">
                           <span className="font-medium">{label}</span>
                           <span className="text-muted-foreground text-xs">
                              {count} {count === 1 ? "item" : "itens"}
                           </span>
                        </div>
                     );
                  }}
                  showGroupToggle={false}
                  table={table}
               />
            </Table>
            {table.getRowCount() === 0 ? (
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <ReceiptText className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhuma NF-e encontrada</EmptyTitle>
                     <EmptyDescription>
                        Quando as consultas do portal estiverem ativas, as notas
                        fiscais aparecerão nesta tabela.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            ) : null}
         </ScrollArea>
         {data.total > 0 ? <DataTablePagination table={table} /> : null}
      </div>
   );
}

function NfeSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function NfePage() {
   return (
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Emita, consulte e acompanhe notas fiscais eletrônicas."
            title="NF-e"
         />
         <QueryBoundary fallback={<NfeSkeleton />}>
            <NfeContent />
         </QueryBoundary>
      </main>
   );
}
