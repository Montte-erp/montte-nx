import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { toast } from "@packages/ui/hooks/use-toast";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
   type ColumnDef,
   type ColumnOrderState,
   type ColumnPinningState,
   getCoreRowModel,
   type OnChangeFn,
   useReactTable,
} from "@tanstack/react-table";
import { Archive, FilePlus2, Plus, RotateCcw } from "lucide-react";
import { useCallback, useMemo } from "react";
import { z } from "zod";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { InlineEditSelect } from "@/blocks/data-table/inline-edit/inline-edit-select";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { ExportButton } from "@/components/export-button/export-button";
import { DefaultHeader } from "../-layout/default-header";
import {
   formatDate,
   initialCustomers,
   makeCustomerDraft,
   type DemoCustomer,
   useDemoContracts,
   useDemoCustomers,
} from "./-local-first-demo/demo-data";
import {
   InlineContactFields,
   InlineDocumentField,
} from "./-local-first-demo/party-inline-fields";

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
   "/_authenticated/$slug/$teamSlug/_dashboard/clientes",
)({
   validateSearch: searchSchema,
   head: () => ({ meta: [{ title: "Clientes — Montte" }] }),
   component: ClientesPage,
});

function getContractCount(
   contracts: ReturnType<typeof useDemoContracts>[0] | null | undefined,
   customerId: string,
) {
   return (contracts ?? []).filter(
      (contract) => contract.customerId === customerId,
   ).length;
}

function sortCustomers(
   rows: DemoCustomer[],
   contracts: ReturnType<typeof useDemoContracts>[0] | null | undefined,
   sorting: { id: string; desc: boolean }[],
) {
   const first = sorting[0];
   if (!first) return rows;
   return [...rows].sort((left, right) => {
      let result = 0;
      if (first.id === "tradeName")
         result = left.tradeName.localeCompare(right.tradeName);
      if (first.id === "name") result = left.name.localeCompare(right.name);
      if (first.id === "document")
         result = left.document.localeCompare(right.document);
      if (first.id === "email") result = left.email.localeCompare(right.email);
      if (first.id === "city")
         result = (left.city ?? "").localeCompare(right.city ?? "");
      if (first.id === "segment")
         result = (left.segment ?? "").localeCompare(right.segment ?? "");
      if (first.id === "owner")
         result = (left.owner ?? "").localeCompare(right.owner ?? "");
      if (first.id === "lastContactAt")
         result = (left.lastContactAt ?? "").localeCompare(
            right.lastContactAt ?? "",
         );
      if (first.id === "updatedAt")
         result = left.updatedAt.localeCompare(right.updatedAt);
      if (first.id === "status")
         result = left.status.localeCompare(right.status);
      if (first.id === "contractCount") {
         result =
            getContractCount(contracts, left.id) -
            getContractCount(contracts, right.id);
      }
      return first.desc ? -result : result;
   });
}

function normalizeCustomerColumnOrder(
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

function normalizeCustomerColumnPinning(
   pinning: ColumnPinningState,
): ColumnPinningState {
   const left = (pinning.left ?? []).filter((id) => id !== "__actions");
   const right = (pinning.right ?? []).filter((id) => id !== "__actions");
   return { left, right: [...right, "__actions"] };
}

function getCustomerColumnId(column: ColumnDef<DemoCustomer>) {
   if (column.id) return column.id;
   if ("accessorKey" in column && typeof column.accessorKey === "string") {
      return column.accessorKey;
   }
   return undefined;
}

function isDefined(value: string | undefined): value is string {
   return typeof value === "string";
}

function ClientesPage() {
   const navigate = Route.useNavigate();
   const params = Route.useParams();
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
   const [customers, setCustomers] = useDemoCustomers();
   const [contracts] = useDemoContracts();
   const data = useMemo(
      () =>
         (customers ?? initialCustomers).map((customer) => ({
            ...customer,
            city: customer.city ?? "",
            state: customer.state ?? "",
            segment: customer.segment ?? "",
            owner: customer.owner ?? "",
            lastContactAt: customer.lastContactAt ?? customer.updatedAt,
         })),
      [customers],
   );
   const {
      state: layoutState,
      onColumnSizingChange,
      onColumnOrderChange,
      onColumnVisibilityChange,
      onColumnPinningChange,
   } = useDataTableLayout("demo-clientes");
   const columnPinning = useMemo(
      () => normalizeCustomerColumnPinning(layoutState.columnPinning),
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
         ? data.filter((customer) =>
              `${customer.name} ${customer.tradeName} ${customer.document} ${customer.email} ${customer.phone} ${customer.city ?? ""} ${customer.state ?? ""} ${customer.segment ?? ""} ${customer.owner ?? ""}`
                 .toLocaleLowerCase()
                 .includes(term),
           )
         : data;
      return sortCustomers(filtered, contracts, sorting);
   }, [data, contracts, search, sorting]);
   const paginatedRows = useMemo(
      () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
      [filteredRows, page, pageSize],
   );

   const createCustomer = useCallback(() => {
      setCustomers((current) => [
         makeCustomerDraft(),
         ...(current ?? initialCustomers),
      ]);
      toast.success("Cliente criado localmente.");
   }, [setCustomers]);

   const updateCustomer = useCallback(
      (id: string, patch: Partial<DemoCustomer>): Promise<void> => {
         if (patch.name !== undefined && patch.name.trim().length < 2) {
            toast.error("Informe o nome do cliente.");
            return Promise.resolve();
         }

         setCustomers((current) => {
            const rows = current ?? initialCustomers;
            return rows.map((customer) =>
               customer.id === id
                  ? { ...customer, ...patch, updatedAt: "2026-05-22" }
                  : customer,
            );
         });
         toast.success("Cliente salvo localmente.");
         return Promise.resolve();
      },
      [setCustomers],
   );

   const setStatus = useCallback(
      (id: string, status: DemoCustomer["status"]) => {
         setCustomers((current) =>
            (current ?? initialCustomers).map((customer) =>
               customer.id === id
                  ? { ...customer, status, updatedAt: "2026-05-22" }
                  : customer,
            ),
         );
         toast.success(
            status === "active" ? "Cliente reativado." : "Cliente arquivado.",
         );
      },
      [setCustomers],
   );

   const columns = useMemo<ColumnDef<DemoCustomer>[]>(() => {
      const selectColumn: ColumnDef<DemoCustomer> = {
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
      const actionsColumn: ColumnDef<DemoCustomer> = {
         id: "__actions",
         size: 112,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => {
            const customer = row.original;
            return (
               <div className="flex justify-end gap-2">
                  <Button
                     asChild
                     size="icon-sm"
                     tooltip="Criar contrato"
                     variant="ghost"
                  >
                     <Link
                        params={params}
                        search={{ customerId: customer.id }}
                        to="/$slug/$teamSlug/contratos"
                     >
                        <FilePlus2 />
                        <span className="sr-only">Criar contrato</span>
                     </Link>
                  </Button>
                  <Button
                     onClick={() =>
                        setStatus(
                           customer.id,
                           customer.status === "active" ? "archived" : "active",
                        )
                     }
                     size="icon-sm"
                     tooltip={
                        customer.status === "active"
                           ? "Arquivar cliente"
                           : "Reativar cliente"
                     }
                     variant="ghost"
                  >
                     {customer.status === "active" ? (
                        <Archive />
                     ) : (
                        <RotateCcw />
                     )}
                     <span className="sr-only">
                        {customer.status === "active"
                           ? "Arquivar cliente"
                           : "Reativar cliente"}
                     </span>
                  </Button>
               </div>
            );
         },
      };
      return [
         selectColumn,
         {
            accessorKey: "tradeName",
            header: "Nome fantasia",
            size: 220,
            meta: { label: "Nome fantasia" },
            cell: ({ row }) => (
               <InlineEditText
                  ariaLabel="Nome fantasia do cliente"
                  onSave={(value) =>
                     updateCustomer(row.original.id, { tradeName: value })
                  }
                  placeholder="Nome de uso"
                  value={row.original.tradeName}
               />
            ),
         },
         {
            accessorKey: "name",
            header: "Razão social",
            size: 260,
            meta: { label: "Razão social" },
            cell: ({ row }) => (
               <InlineEditText
                  ariaLabel="Razão social do cliente"
                  onSave={(value) =>
                     updateCustomer(row.original.id, { name: value })
                  }
                  placeholder="Razão social"
                  value={row.original.name}
               />
            ),
         },
         {
            accessorKey: "document",
            header: "Documento",
            size: 260,
            meta: { label: "Documento" },
            cell: ({ row }) => (
               <InlineDocumentField
                  document={row.original.document}
                  documentType={row.original.documentType}
                  onSave={(patch) => updateCustomer(row.original.id, patch)}
               />
            ),
         },
         {
            accessorKey: "email",
            header: "Contato",
            size: 260,
            meta: { label: "Contato" },
            cell: ({ row }) => (
               <InlineContactFields
                  email={row.original.email}
                  emailLabel="E-mail do cliente"
                  onSave={(patch) => updateCustomer(row.original.id, patch)}
                  phone={row.original.phone}
                  phoneLabel="Telefone do cliente"
               />
            ),
         },
         {
            accessorKey: "city",
            header: "Cidade",
            size: 220,
            meta: { label: "Cidade" },
            cell: ({ row }) => (
               <div className="flex items-center gap-2">
                  <InlineEditText
                     ariaLabel="Cidade do cliente"
                     onSave={(value) =>
                        updateCustomer(row.original.id, { city: value })
                     }
                     placeholder="Cidade"
                     value={row.original.city ?? ""}
                  />
                  <InlineEditText
                     ariaLabel="UF do cliente"
                     className="max-w-12 text-center uppercase"
                     onSave={(value) =>
                        updateCustomer(row.original.id, {
                           state: value.trim().toLocaleUpperCase(),
                        })
                     }
                     placeholder="UF"
                     value={row.original.state ?? ""}
                  />
               </div>
            ),
         },
         {
            accessorKey: "segment",
            header: "Segmento",
            size: 180,
            meta: { label: "Segmento" },
            cell: ({ row }) => (
               <InlineEditText
                  ariaLabel="Segmento do cliente"
                  onSave={(value) =>
                     updateCustomer(row.original.id, { segment: value })
                  }
                  placeholder="Segmento"
                  value={row.original.segment ?? ""}
               />
            ),
         },
         {
            accessorKey: "owner",
            header: "Responsável",
            size: 190,
            meta: { label: "Responsável" },
            cell: ({ row }) => (
               <InlineEditText
                  ariaLabel="Responsável pelo cliente"
                  onSave={(value) =>
                     updateCustomer(row.original.id, { owner: value })
                  }
                  placeholder="Responsável"
                  value={row.original.owner ?? ""}
               />
            ),
         },
         {
            id: "contractCount",
            header: "Contratos",
            size: 120,
            meta: { align: "right", label: "Contratos" },
            accessorFn: (row) => getContractCount(contracts, row.id),
            cell: ({ row }) => (
               <span className="tabular-nums">
                  {getContractCount(contracts, row.original.id)}
               </span>
            ),
         },
         {
            accessorKey: "lastContactAt",
            header: "Último contato",
            size: 150,
            meta: { label: "Último contato" },
            cell: ({ row }) =>
               formatDate(row.original.lastContactAt ?? row.original.updatedAt),
         },
         {
            accessorKey: "updatedAt",
            header: "Atualizado",
            size: 130,
            meta: { label: "Atualizado" },
            cell: ({ row }) => formatDate(row.original.updatedAt),
         },
         {
            accessorKey: "status",
            header: "Status",
            size: 140,
            meta: { label: "Status" },
            cell: ({ row }) => (
               <InlineEditSelect
                  ariaLabel="Status do cliente"
                  onSave={(value) =>
                     updateCustomer(row.original.id, {
                        status: value === "archived" ? "archived" : "active",
                     })
                  }
                  options={[
                     { value: "active", label: "Ativo" },
                     { value: "archived", label: "Arquivado" },
                  ]}
                  value={row.original.status}
               />
            ),
         },
         actionsColumn,
      ];
   }, [contracts, params, setStatus, updateCustomer]);
   const columnIds = useMemo(
      () => columns.map(getCustomerColumnId).filter(isDefined),
      [columns],
   );
   const columnOrder = useMemo(
      () => normalizeCustomerColumnOrder(layoutState.columnOrder, columnIds),
      [layoutState.columnOrder, columnIds],
   );
   const handleColumnOrderChange = useCallback<OnChangeFn<ColumnOrderState>>(
      (updater) => {
         onColumnOrderChange((prev) =>
            normalizeCustomerColumnOrder(
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
            normalizeCustomerColumnPinning(
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

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Cadastro separado para quem compra da empresa e aparece nos contratos de receita."
            title="Clientes"
         />
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar clientes"
                  onChange={(event) => searchInput.onChange(event.target.value)}
                  placeholder="Buscar clientes..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="clientes-demo" />
                  <Button
                     onClick={createCustomer}
                     size="icon-sm"
                     tooltip="Novo cliente"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Novo cliente</span>
                  </Button>
               </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<DemoCustomer> table={table} />
               </Table>
            </ScrollArea>
            <DataTablePagination table={table} />
         </div>
      </main>
   );
}
