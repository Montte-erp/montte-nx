import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import {
   useMutation,
   useQueryClient,
   useSuspenseQueries,
} from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import {
   getCoreRowModel,
   getFilteredRowModel,
   getSortedRowModel,
   useReactTable,
   type ColumnDef,
   type ColumnFiltersState,
   type RowSelectionState,
   type SortingState,
} from "@tanstack/react-table";
import { Briefcase, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/components/sonner";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { DataImportButton } from "@/blocks/data-table/data-import/data-import-button";
import { DataImportSection } from "@/blocks/data-table/data-import/data-import-section";
import { useDataImport } from "@/blocks/data-table/data-import/use-data-import";
import type { DataImportConfig } from "@/blocks/data-table/data-import/use-data-import";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { useSheet } from "@/hooks/use-sheet";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import { ServiceFormSheet } from "./service-form-sheet";
import { buildServiceColumns, type ServiceRow } from "./services-columns";

const routeApi = getRouteApi(
   "/_authenticated/$slug/$teamSlug/_dashboard/services/",
);

const servicesListSearchSchema = {
   sorting: [] as SortingState,
   columnFilters: [] as ColumnFiltersState,
};

export function ServicesList() {
   const routeNavigate = routeApi.useNavigate();
   const navigate = useNavigate();
   const { search, view } = routeApi.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const queryClient = useQueryClient();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();
   const layout = useDataTableLayout("services");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         routeNavigate({
            search: (prev) => ({ ...prev, search: value }),
            replace: true,
         }),
   });

   const [{ data: servicesList }, { data: stats }] = useSuspenseQueries({
      queries: [
         orpc.services.getAll.queryOptions({}),
         orpc.services.getAllStats.queryOptions({}),
      ],
   });

   const statsById = useMemo(
      () =>
         stats.reduce<
            Record<
               string,
               { priceCount: number; subscriberCount: number; mrr: string }
            >
         >((acc, s) => {
            acc[s.serviceId] = {
               priceCount: s.priceCount,
               subscriberCount: s.subscriberCount,
               mrr: s.mrr,
            };
            return acc;
         }, {}),
      [stats],
   );

   const filtered = useMemo(() => {
      let result: ServiceRow[] = servicesList.map((s) => {
         const st = statsById[s.id] ?? {
            priceCount: 0,
            subscriberCount: 0,
            mrr: "0",
         };
         return {
            id: s.id,
            name: s.name,
            description: s.description,
            categoryId: s.categoryId,
            categoryName: s.category?.name ?? null,
            categoryColor: s.category?.color ?? null,
            tagId: s.tagId,
            tagName: s.tag?.name ?? null,
            tagColor: s.tag?.color ?? null,
            isActive: s.isActive,
            priceCount: st.priceCount,
            subscriberCount: st.subscriberCount,
            mrr: st.mrr,
         };
      });
      if (view === "ativos") result = result.filter((s) => s.isActive);
      if (view === "arquivados") result = result.filter((s) => !s.isActive);
      if (search) {
         const q = search.toLowerCase();
         result = result.filter(
            (s) =>
               s.name.toLowerCase().includes(q) ||
               s.description?.toLowerCase().includes(q),
         );
      }
      return result;
   }, [servicesList, statsById, search, view]);

   const importMutation = useMutation(
      orpc.services.bulkCreate.mutationOptions({
         meta: { skipGlobalInvalidation: true },
      }),
   );

   const deleteMutation = useMutation(
      orpc.services.remove.mutationOptions({
         onSuccess: () => toast.success("Serviço excluído com sucesso."),
         onError: (e) => toast.error(e.message || "Erro ao excluir serviço."),
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.services.bulkRemove.mutationOptions({
         onError: (e) => toast.error(e.message || "Erro ao excluir serviços."),
      }),
   );

   const handleOpenCreate = useCallback(() => {
      openSheet({ renderChildren: () => <ServiceFormSheet /> });
   }, [openSheet]);

   const importConfig: DataImportConfig = useMemo(
      () => ({
         accept: {
            "text/csv": [".csv"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
               [".xlsx"],
            "application/vnd.ms-excel": [".xls"],
         },
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         mapRow: (row, i) => ({
            id: `__import_${i}`,
            name: String(row.name ?? "").trim(),
            description: String(row.description ?? "").trim() || null,
         }),
         onImport: async (rows) => {
            const items: { name: string; description?: string }[] = [];
            for (const r of rows) {
               const name = String(r.name ?? "").trim();
               if (!name) continue;
               const description =
                  r.description != null
                     ? String(r.description) || undefined
                     : undefined;
               items.push({ name, description });
            }
            if (items.length === 0) {
               toast.error("Nenhum serviço válido para importar.");
               return;
            }
            const created = await importMutation
               .mutateAsync({ items })
               .catch(() => null);
            if (!created) {
               toast.error(`${items.length} serviço(s) com erro.`);
               return;
            }
            const ok = created.length;
            const failed = items.length - ok;
            if (ok > 0) toast.success(`${ok} serviço(s) importado(s).`);
            if (failed > 0) toast.error(`${failed} serviço(s) com erro.`);
            await queryClient.invalidateQueries({
               queryKey: orpc.services.getAll.queryKey(),
            });
         },
      }),
      [parseCsv, parseXlsx, importMutation, queryClient],
   );

   const handleDelete = useCallback(
      (row: ServiceRow) => {
         openAlertDialog({
            title: "Excluir serviço",
            description: `Excluir "${row.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: row.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo<ColumnDef<ServiceRow>[]>(() => {
      const base = buildServiceColumns();
      const selectColumn: ColumnDef<ServiceRow> = {
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
               onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            />
         ),
         cell: ({ row }) => (
            <Checkbox
               aria-label="Selecionar linha"
               checked={row.getIsSelected()}
               disabled={!row.getCanSelect()}
               onCheckedChange={(v) => row.toggleSelected(!!v)}
            />
         ),
      };
      const actionsColumn: ColumnDef<ServiceRow> = {
         id: "__actions",
         size: 100,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  onClick={() =>
                     navigate({
                        to: "/$slug/$teamSlug/services/$serviceId",
                        params: {
                           slug,
                           teamSlug,
                           serviceId: row.original.id,
                        },
                     })
                  }
                  size="icon-sm"
                  tooltip="Ver detalhes"
                  variant="ghost"
               >
                  <ExternalLink />
                  <span className="sr-only">Ver detalhes</span>
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  size="icon-sm"
                  tooltip="Excluir"
                  variant="ghost"
               >
                  <Trash2 />
                  <span className="sr-only">Excluir</span>
               </Button>
            </div>
         ),
      };
      return [selectColumn, ...base, actionsColumn];
   }, [navigate, slug, teamSlug, handleDelete]);

   const [sorting, setSorting] = useState<SortingState>(
      servicesListSearchSchema.sorting,
   );
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
      servicesListSearchSchema.columnFilters,
   );
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const table = useReactTable({
      data: filtered,
      columns,
      getRowId: (r) => r.id,
      state: { sorting, columnFilters, rowSelection },
      onSortingChange: setSorting,
      onColumnFiltersChange: setColumnFilters,
      onRowSelectionChange: setRowSelection,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      initialState: {
         columnSizing: layout.initialState.columnSizing,
         columnOrder: layout.initialState.columnOrder,
         columnVisibility: layout.initialState.columnVisibility,
         columnPinning: layout.initialState.columnPinning,
      },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
   });

   const importApi = useDataImport({ table, config: importConfig });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((r) => r.original.id);

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <SelectionActionButton
            icon={<Trash2 />}
            variant="destructive"
            onClick={() =>
               openAlertDialog({
                  title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "serviço" : "serviços"}`,
                  description:
                     "Tem certeza que deseja excluir os serviços selecionados? Esta ação não pode ser desfeita.",
                  actionLabel: "Excluir",
                  cancelLabel: "Cancelar",
                  variant: "destructive",
                  onAction: async () => {
                     const res = await bulkDeleteMutation
                        .mutateAsync({ ids: selectedIds })
                        .catch(() => null);
                     if (res) {
                        if (res.deleted > 0)
                           toast.success(
                              `${res.deleted} serviço(s) excluído(s).`,
                           );
                        if (res.failed > 0)
                           toast.error(`${res.failed} serviço(s) com erro.`);
                     }
                     table.resetRowSelection();
                  },
               })
            }
         >
            Excluir
         </SelectionActionButton>
      ),
   });

   return (
      <div className="flex flex-col gap-4">
         <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  aria-label="Buscar serviços"
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  placeholder="Buscar serviços..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     id="tour-services-create"
                     onClick={handleOpenCreate}
                     size="icon-sm"
                     tooltip="Novo Serviço"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Novo Serviço</span>
                  </Button>
               </div>
            </div>
            <ScrollArea className="rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<ServiceRow> table={table} />
               </Table>
            </ScrollArea>
            <DataImportSection
               api={importApi}
               config={importConfig}
               table={table}
            />
            {table.getRowCount() === 0 && (
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <Briefcase className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum serviço cadastrado</EmptyTitle>
                     <EmptyDescription>
                        {search ? (
                           "Nenhum serviço encontrado para a busca."
                        ) : (
                           <>
                              Crie seu primeiro serviço. Antes, configure{" "}
                              <Link
                                 className="underline underline-offset-2"
                                 params={{ slug, teamSlug }}
                                 to="/$slug/$teamSlug/services/meters"
                              >
                                 medidores
                              </Link>{" "}
                              de consumo se cobra por uso.
                           </>
                        )}
                     </EmptyDescription>
                  </EmptyHeader>
                  {!search && (
                     <EmptyContent>
                        <Button onClick={handleOpenCreate}>
                           <Plus />
                           Novo serviço
                        </Button>
                     </EmptyContent>
                  )}
               </Empty>
            )}
         </div>
      </div>
   );
}
