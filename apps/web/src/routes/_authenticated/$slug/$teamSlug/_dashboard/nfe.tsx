import { useSuspenseQuery } from "@tanstack/react-query";
import {
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
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
import dayjs from "dayjs";
import { ReceiptText } from "lucide-react";
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
import { useCredenza } from "@/hooks/use-credenza";
import { orpc, type Outputs } from "@/integrations/orpc/client";
import { DefaultHeader } from "../-layout/default-header";
import { useEffect, useRef } from "react";

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

const columns = buildNfeColumns();

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
         meta: { label: "Valor", align: "right" },
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
         meta: { label: "Status" },
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
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
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

   useEffect(() => {
      if (ready || didOpenSetup.current) return;
      didOpenSetup.current = true;
      openCredenza({
         className: "sm:max-w-md",
         renderChildren: () => (
            <ConfigurePortalCredenza
               onConfigure={() =>
                  navigate({
                     params: { slug, teamSlug },
                     to: "/$slug/$teamSlug/settings/project/modules/nfe",
                  })
               }
            />
         ),
      });
      return closeCredenza;
   }, [closeCredenza, navigate, openCredenza, ready, slug, teamSlug]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
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
      state: { ...urlState.state, ...layout.state },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      getCoreRowModel: getCoreRowModel(),
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
            <DataTableColumnVisibility table={table} />
         </div>
         <DataTableFilterChips table={table} />
         <ScrollArea className="min-h-0 flex-1 rounded-md border bg-card">
            <Table>
               <DataTableHeader table={table} />
               <DataTableBody<NfeRow> table={table} />
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
   return <DataTableSkeleton columns={columns} />;
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
