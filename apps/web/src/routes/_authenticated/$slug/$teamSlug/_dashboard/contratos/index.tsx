import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
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
import { FileText, Pencil, PlayCircle, Plus, Trash2 } from "lucide-react";
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
import { DefaultHeader } from "../../-layout/default-header";
import {
   contractTemplates,
   formatCurrency,
   formatDate,
   frequencyLabel,
   getContractPartyName,
   initialContracts,
   initialCustomers,
   initialSuppliers,
   makeContractDraft,
   statusLabel,
   type ContractStatus,
   type DemoContract,
   useDemoContracts,
   useDemoCustomers,
   useDemoSuppliers,
} from "../-local-first-demo/demo-data";

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
   customerId: z.string().catch("").default(""),
   supplierId: z.string().catch("").default(""),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().min(1).max(100).catch(20).default(20),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contratos/",
)({
   validateSearch: searchSchema,
   head: () => ({ meta: [{ title: "Contratos - Montte" }] }),
   component: ContratosPage,
});

function ContratosPage() {
   const [customers] = useDemoCustomers();
   const [suppliers] = useDemoSuppliers();
   const [contracts, setContracts] = useDemoContracts();
   const customersData = customers ?? initialCustomers;
   const suppliersData = suppliers ?? initialSuppliers;
   const contractsData = contracts ?? initialContracts;
   const navigate = Route.useNavigate();
   const params = Route.useParams();
   const {
      sorting,
      columnFilters,
      search,
      customerId,
      supplierId,
      page,
      pageSize,
   } = Route.useSearch();
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

   const scopedContracts = useMemo(() => {
      if (customerId)
         return contractsData.filter(
            (contract) => contract.customerId === customerId,
         );
      if (supplierId)
         return contractsData.filter(
            (contract) => contract.supplierId === supplierId,
         );
      return contractsData;
   }, [contractsData, customerId, supplierId]);

   const filteredContracts = useMemo(() => {
      const term = search.trim().toLocaleLowerCase();
      const filtered = term
         ? scopedContracts.filter((contract) =>
              `${contract.number} ${contract.title} ${contract.serviceDescription} ${getContractPartyName(
                 {
                    contract,
                    customers: customersData,
                    suppliers: suppliersData,
                 },
              )}`
                 .toLocaleLowerCase()
                 .includes(term),
           )
         : scopedContracts;
      return sortContracts(filtered, sorting);
   }, [customersData, scopedContracts, search, sorting, suppliersData]);

   const paginatedContracts = useMemo(
      () => filteredContracts.slice((page - 1) * pageSize, page * pageSize),
      [filteredContracts, page, pageSize],
   );

   const openContract = useCallback(
      (contractId: string) =>
         navigate({
            to: "/$slug/$teamSlug/contratos/$contractId",
            params: { ...params, contractId },
         }),
      [navigate, params],
   );

   const updateContract = useCallback(
      (id: string, patch: Partial<DemoContract>) => {
         setContracts((current) =>
            (current ?? initialContracts).map((contract) =>
               contract.id === id
                  ? { ...contract, ...patch, updatedAt: "2026-05-22" }
                  : contract,
            ),
         );
      },
      [setContracts],
   );

   const createContract = useCallback(
      (templateId: string) => {
         const draft = makeContractDraft({ customers: customersData });
         const template = contractTemplates.find(
            (item) => item.id === templateId,
         );
         const direction =
            template?.direction === "despesa" ? "despesa" : "receita";
         const next: DemoContract = {
            ...draft,
            direction,
            customerId:
               direction === "receita"
                  ? customerId || customersData[0]?.id || ""
                  : "",
            supplierId:
               direction === "despesa"
                  ? supplierId || suppliersData[0]?.id || ""
                  : "",
            title:
               templateId === "blank"
                  ? "Novo contrato em branco"
                  : direction === "despesa"
                    ? "Novo contrato com fornecedor"
                    : "Novo contrato com cliente",
            templateId: template?.id ?? "personalizado",
            document: template?.document ?? [
               { type: "p", children: [{ text: "" }] },
            ],
         };
         setContracts((current) => [next, ...(current ?? initialContracts)]);
         toast.success("Contrato criado localmente.");
         openContract(next.id);
      },
      [
         customerId,
         customersData,
         openContract,
         setContracts,
         supplierId,
         suppliersData,
      ],
   );

   const handleDelete = useCallback(
      (id: string) => {
         openAlertDialog({
            title: "Excluir contrato local",
            description:
               "Este registro existe apenas no localStorage da demo. A exclusão remove o contrato e suas cobranças simuladas.",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: () => {
               setContracts((current) =>
                  (current ?? initialContracts).filter(
                     (contract) => contract.id !== id,
                  ),
               );
               toast.success("Contrato excluído da demo.");
            },
         });
      },
      [openAlertDialog, setContracts],
   );

   const columns = useMemo<ColumnDef<DemoContract>[]>(() => {
      const selectColumn: ColumnDef<DemoContract> = {
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
               aria-label="Selecionar contrato"
               checked={row.getIsSelected()}
               onCheckedChange={(value) => row.toggleSelected(!!value)}
            />
         ),
      };
      return [
         selectColumn,
         ...buildContractColumns({
            customers: customersData,
            suppliers: suppliersData,
            onOpen: openContract,
            onActivate: (id) => updateContract(id, { status: "active" }),
            onDelete: handleDelete,
         }),
      ];
   }, [
      customersData,
      handleDelete,
      openContract,
      suppliersData,
      updateContract,
   ]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
      onUpdate: (next) =>
         navigate({ search: (prev) => ({ ...prev, ...next }), replace: true }),
      totalRows: filteredContracts.length,
   });

   const table = useReactTable({
      data: paginatedContracts,
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

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Liste contratos locais, acompanhe recorrência e abra o documento para edição completa."
            title="Contratos"
         />
         <div className="flex flex-1 min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
               <SearchInput
                  aria-label="Buscar contratos"
                  className="max-w-sm"
                  onChange={(event) => searchInput.onChange(event.target.value)}
                  placeholder="Buscar por contrato, parte ou serviço..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="contratos-demo" />
                  <CreateContractMenu onCreate={createContract} />
               </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<DemoContract> table={table} />
               </Table>
               {table.getRowCount() === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                     <FileText className="size-6" />
                     Nenhum contrato encontrado.
                  </div>
               )}
            </ScrollArea>
            <DataTablePagination table={table} />
         </div>
      </main>
   );
}

function CreateContractMenu({
   onCreate,
}: {
   onCreate: (templateId: string) => void;
}) {
   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button size="icon-sm" tooltip="Novo contrato" variant="outline">
               <Plus />
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Novo contrato</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {contractTemplates.map((template) => (
               <DropdownMenuItem
                  key={template.id}
                  onSelect={() => onCreate(template.id)}
               >
                  <div className="flex flex-col gap-1">
                     <span>{template.title}</span>
                     <span className="text-xs text-muted-foreground">
                        {template.description}
                     </span>
                  </div>
               </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onCreate("blank")}>
               Criar do zero
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}

function buildContractColumns({
   customers,
   onActivate,
   onDelete,
   onOpen,
   suppliers,
}: {
   customers: typeof initialCustomers;
   onActivate: (id: string) => void;
   onDelete: (id: string) => void;
   onOpen: (id: string) => void;
   suppliers: typeof initialSuppliers;
}): ColumnDef<DemoContract>[] {
   return [
      {
         accessorKey: "number",
         header: "Contrato",
         meta: { label: "Contrato", exportable: true },
         cell: ({ row }) => (
            <button
               className="text-left font-medium hover:underline"
               onClick={() => onOpen(row.original.id)}
               type="button"
            >
               {row.original.number}
            </button>
         ),
      },
      {
         accessorKey: "title",
         header: "Título",
         meta: { label: "Título", filterVariant: "text", exportable: true },
         cell: ({ row }) => (
            <span className="truncate">{row.original.title}</span>
         ),
      },
      {
         id: "parte",
         header: "Parte",
         meta: { label: "Parte", exportable: true },
         cell: ({ row }) =>
            getContractPartyName({
               contract: row.original,
               customers,
               suppliers,
            }),
      },
      {
         accessorKey: "direction",
         header: "Tipo",
         meta: { label: "Tipo", exportable: true },
         cell: ({ row }) =>
            row.original.direction === "receita" ? "Receita" : "Despesa",
      },
      {
         accessorKey: "billing.amount",
         header: "Recorrência",
         meta: { label: "Recorrência", align: "right", exportable: true },
         cell: ({ row }) => (
            <span className="font-medium tabular-nums">
               {formatCurrency(row.original.billing.amount)}
            </span>
         ),
      },
      {
         accessorKey: "billing.frequency",
         header: "Frequência",
         meta: { label: "Frequência", exportable: true },
         cell: ({ row }) => frequencyLabel(row.original.billing.frequency),
      },
      {
         accessorKey: "billing.firstDueDate",
         header: "Próxima cobrança",
         meta: { label: "Próxima cobrança", exportable: true },
         cell: ({ row }) => formatDate(row.original.billing.firstDueDate),
      },
      {
         accessorKey: "billing.endDate",
         header: "Fim",
         meta: { label: "Fim", exportable: true },
         cell: ({ row }) => formatDate(row.original.billing.endDate),
      },
      {
         accessorKey: "status",
         header: "Status",
         meta: { label: "Status", filterVariant: "select", exportable: true },
         cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
         id: "__actions",
         size: 132,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right", importIgnore: true },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  onClick={() => onOpen(row.original.id)}
                  size="icon-sm"
                  tooltip="Editar contrato"
                  variant="outline"
               >
                  <Pencil />
               </Button>
               <Button
                  disabled={row.original.status === "active"}
                  onClick={() => onActivate(row.original.id)}
                  size="icon-sm"
                  tooltip="Ativar recorrência"
                  variant="outline"
               >
                  <PlayCircle />
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(row.original.id)}
                  size="icon-sm"
                  tooltip="Excluir contrato"
                  variant="outline"
               >
                  <Trash2 />
               </Button>
            </div>
         ),
      },
   ];
}

function sortContracts(
   contracts: DemoContract[],
   sorting: { id: string; desc: boolean }[],
) {
   const first = sorting[0];
   if (!first) return contracts;
   return [...contracts].sort((left, right) => {
      let result = 0;
      if (first.id === "number")
         result = left.number.localeCompare(right.number);
      if (first.id === "title") result = left.title.localeCompare(right.title);
      if (first.id === "direction")
         result = left.direction.localeCompare(right.direction);
      if (first.id === "status")
         result = left.status.localeCompare(right.status);
      if (first.id === "billing.amount")
         result = left.billing.amount - right.billing.amount;
      if (first.id === "billing.firstDueDate")
         result = left.billing.firstDueDate.localeCompare(
            right.billing.firstDueDate,
         );
      return first.desc ? -result : result;
   });
}

function StatusBadge({ status }: { status: ContractStatus }) {
   if (status === "active")
      return <span className="text-success">{statusLabel(status)}</span>;
   if (status === "ended")
      return <span className="text-destructive">{statusLabel(status)}</span>;
   return <span>{statusLabel(status)}</span>;
}
