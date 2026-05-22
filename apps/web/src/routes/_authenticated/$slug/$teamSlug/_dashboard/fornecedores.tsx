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
   initialSuppliers,
   makeSupplierDraft,
   type DemoSupplier,
   useDemoContracts,
   useDemoSuppliers,
} from "./-local-first-demo/demo-data";

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
   "/_authenticated/$slug/$teamSlug/_dashboard/fornecedores",
)({
   validateSearch: searchSchema,
   head: () => ({ meta: [{ title: "Fornecedores — Montte" }] }),
   component: FornecedoresPage,
});

function getContractCount(
   contracts: ReturnType<typeof useDemoContracts>[0] | null | undefined,
   supplierId: string,
) {
   return (contracts ?? []).filter(
      (contract) => contract.supplierId === supplierId,
   ).length;
}

function sortSuppliers(
   rows: DemoSupplier[],
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
      if (first.id === "documentType")
         result = left.documentType.localeCompare(right.documentType);
      if (first.id === "document")
         result = left.document.localeCompare(right.document);
      if (first.id === "email") result = left.email.localeCompare(right.email);
      if (first.id === "phone") result = left.phone.localeCompare(right.phone);
      if (first.id === "city")
         result = (left.city ?? "").localeCompare(right.city ?? "");
      if (first.id === "state")
         result = (left.state ?? "").localeCompare(right.state ?? "");
      if (first.id === "category")
         result = (left.category ?? "").localeCompare(right.category ?? "");
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

function normalizeSupplierColumnOrder(
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

function normalizeSupplierColumnPinning(
   pinning: ColumnPinningState,
): ColumnPinningState {
   const left = (pinning.left ?? []).filter((id) => id !== "__actions");
   const right = (pinning.right ?? []).filter((id) => id !== "__actions");
   return { left, right: [...right, "__actions"] };
}

function getSupplierColumnId(column: ColumnDef<DemoSupplier>) {
   if (column.id) return column.id;
   if ("accessorKey" in column && typeof column.accessorKey === "string") {
      return column.accessorKey;
   }
   return undefined;
}

function isDefined(value: string | undefined): value is string {
   return typeof value === "string";
}

function FornecedoresPage() {
   const navigate = Route.useNavigate();
   const params = Route.useParams();
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
   const [suppliers, setSuppliers] = useDemoSuppliers();
   const [contracts] = useDemoContracts();
   const data = useMemo(
      () =>
         (suppliers ?? initialSuppliers).map((supplier) => ({
            ...supplier,
            city: supplier.city ?? "",
            state: supplier.state ?? "",
            category: supplier.category ?? "",
            owner: supplier.owner ?? "",
            lastContactAt: supplier.lastContactAt ?? supplier.updatedAt,
         })),
      [suppliers],
   );
   const {
      state: layoutState,
      onColumnSizingChange,
      onColumnOrderChange,
      onColumnVisibilityChange,
      onColumnPinningChange,
   } = useDataTableLayout("demo-fornecedores");
   const columnPinning = useMemo(
      () => normalizeSupplierColumnPinning(layoutState.columnPinning),
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
         ? data.filter((supplier) =>
              `${supplier.name} ${supplier.tradeName} ${supplier.document} ${supplier.email} ${supplier.phone} ${supplier.city ?? ""} ${supplier.state ?? ""} ${supplier.category ?? ""} ${supplier.owner ?? ""}`
                 .toLocaleLowerCase()
                 .includes(term),
           )
         : data;
      return sortSuppliers(filtered, contracts, sorting);
   }, [data, contracts, search, sorting]);
   const paginatedRows = useMemo(
      () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
      [filteredRows, page, pageSize],
   );

   const createSupplier = useCallback(() => {
      setSuppliers((current) => [
         makeSupplierDraft(),
         ...(current ?? initialSuppliers),
      ]);
      toast.success("Fornecedor criado localmente.");
   }, [setSuppliers]);

   const updateSupplier = useCallback(
      (id: string, patch: Partial<DemoSupplier>): Promise<void> => {
         if (patch.name !== undefined && patch.name.trim().length < 2) {
            toast.error("Informe o nome do fornecedor.");
            return Promise.resolve();
         }

         setSuppliers((current) => {
            const rows = current ?? initialSuppliers;
            return rows.map((supplier) =>
               supplier.id === id
                  ? { ...supplier, ...patch, updatedAt: "2026-05-22" }
                  : supplier,
            );
         });
         toast.success("Fornecedor salvo localmente.");
         return Promise.resolve();
      },
      [setSuppliers],
   );

   const setStatus = useCallback(
      (id: string, status: DemoSupplier["status"]) => {
         setSuppliers((current) =>
            (current ?? initialSuppliers).map((supplier) =>
               supplier.id === id
                  ? { ...supplier, status, updatedAt: "2026-05-22" }
                  : supplier,
            ),
         );
         toast.success(
            status === "active"
               ? "Fornecedor reativado."
               : "Fornecedor arquivado.",
         );
      },
      [setSuppliers],
   );

   const columns = useMemo<ColumnDef<DemoSupplier>[]>(() => {
      const selectColumn: ColumnDef<DemoSupplier> = {
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
      const actionsColumn: ColumnDef<DemoSupplier> = {
         id: "__actions",
         size: 112,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => {
            const supplier = row.original;
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
                        search={{ supplierId: supplier.id }}
                        to="/$slug/$teamSlug/contratos"
                     >
                        <FilePlus2 />
                        <span className="sr-only">Criar contrato</span>
                     </Link>
                  </Button>
                  <Button
                     onClick={() =>
                        setStatus(
                           supplier.id,
                           supplier.status === "active" ? "archived" : "active",
                        )
                     }
                     size="icon-sm"
                     tooltip={
                        supplier.status === "active"
                           ? "Arquivar fornecedor"
                           : "Reativar fornecedor"
                     }
                     variant="ghost"
                  >
                     {supplier.status === "active" ? (
                        <Archive />
                     ) : (
                        <RotateCcw />
                     )}
                     <span className="sr-only">
                        {supplier.status === "active"
                           ? "Arquivar fornecedor"
                           : "Reativar fornecedor"}
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
                  ariaLabel="Nome fantasia do fornecedor"
                  onSave={(value) =>
                     updateSupplier(row.original.id, { tradeName: value })
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
                  ariaLabel="Razão social do fornecedor"
                  onSave={(value) =>
                     updateSupplier(row.original.id, { name: value })
                  }
                  placeholder="Razão social"
                  value={row.original.name}
               />
            ),
         },
         {
            accessorKey: "documentType",
            header: "Tipo doc.",
            size: 110,
            meta: { label: "Tipo doc." },
            cell: ({ row }) => (
               <InlineEditSelect
                  ariaLabel="Tipo de documento do fornecedor"
                  onSave={(value) =>
                     updateSupplier(row.original.id, {
                        documentType: value === "cpf" ? "cpf" : "cnpj",
                     })
                  }
                  options={[
                     { value: "cnpj", label: "CNPJ" },
                     { value: "cpf", label: "CPF" },
                  ]}
                  value={row.original.documentType}
               />
            ),
         },
         {
            accessorKey: "document",
            header: "Documento",
            size: 180,
            meta: { label: "Documento" },
            cell: ({ row }) => (
               <InlineEditText
                  ariaLabel="Documento do fornecedor"
                  onSave={(value) =>
                     updateSupplier(row.original.id, { document: value })
                  }
                  placeholder="Documento"
                  value={row.original.document}
               />
            ),
         },
         {
            accessorKey: "email",
            header: "E-mail",
            size: 240,
            meta: { label: "E-mail" },
            cell: ({ row }) => (
               <InlineEditText
                  ariaLabel="E-mail do fornecedor"
                  onSave={(value) =>
                     updateSupplier(row.original.id, { email: value })
                  }
                  placeholder="E-mail"
                  value={row.original.email}
               />
            ),
         },
         {
            accessorKey: "phone",
            header: "Telefone",
            size: 150,
            meta: { label: "Telefone" },
            cell: ({ row }) => (
               <InlineEditText
                  ariaLabel="Telefone do fornecedor"
                  onSave={(value) =>
                     updateSupplier(row.original.id, { phone: value })
                  }
                  placeholder="Telefone"
                  value={row.original.phone}
               />
            ),
         },
         {
            accessorKey: "city",
            header: "Cidade",
            size: 170,
            meta: { label: "Cidade" },
            cell: ({ row }) => (
               <InlineEditText
                  ariaLabel="Cidade do fornecedor"
                  onSave={(value) =>
                     updateSupplier(row.original.id, { city: value })
                  }
                  placeholder="Cidade"
                  value={row.original.city ?? ""}
               />
            ),
         },
         {
            accessorKey: "state",
            header: "UF",
            size: 80,
            meta: { label: "UF" },
            cell: ({ row }) => (
               <InlineEditText
                  ariaLabel="UF do fornecedor"
                  className="text-center uppercase"
                  onSave={(value) =>
                     updateSupplier(row.original.id, {
                        state: value.trim().toLocaleUpperCase(),
                     })
                  }
                  placeholder="UF"
                  value={row.original.state ?? ""}
               />
            ),
         },
         {
            accessorKey: "category",
            header: "Tipo",
            size: 180,
            meta: { label: "Tipo" },
            cell: ({ row }) => (
               <InlineEditText
                  ariaLabel="Tipo de fornecedor"
                  onSave={(value) =>
                     updateSupplier(row.original.id, { category: value })
                  }
                  placeholder="Tipo"
                  value={row.original.category ?? ""}
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
                  ariaLabel="Responsável pelo fornecedor"
                  onSave={(value) =>
                     updateSupplier(row.original.id, { owner: value })
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
                  ariaLabel="Status do fornecedor"
                  onSave={(value) =>
                     updateSupplier(row.original.id, {
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
   }, [contracts, params, setStatus, updateSupplier]);
   const columnIds = useMemo(
      () => columns.map(getSupplierColumnId).filter(isDefined),
      [columns],
   );
   const columnOrder = useMemo(
      () => normalizeSupplierColumnOrder(layoutState.columnOrder, columnIds),
      [layoutState.columnOrder, columnIds],
   );
   const handleColumnOrderChange = useCallback<OnChangeFn<ColumnOrderState>>(
      (updater) => {
         onColumnOrderChange((prev) =>
            normalizeSupplierColumnOrder(
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
            normalizeSupplierColumnPinning(
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
            description="Cadastro separado para quem presta serviço, vende para a empresa ou gera contratos de despesa."
            title="Fornecedores"
         />
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar fornecedores"
                  onChange={(event) => searchInput.onChange(event.target.value)}
                  placeholder="Buscar fornecedores..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="fornecedores-demo" />
                  <Button
                     onClick={createSupplier}
                     size="icon-sm"
                     tooltip="Novo fornecedor"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Novo fornecedor</span>
                  </Button>
               </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<DemoSupplier> table={table} />
               </Table>
            </ScrollArea>
            <DataTablePagination table={table} />
         </div>
      </main>
   );
}
