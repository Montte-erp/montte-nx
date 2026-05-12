import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import {
   Empty,
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
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
   type PaginationState,
   type RowSelectionState,
   type SortingState,
} from "@tanstack/react-table";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Plus, Tag, Trash2 } from "lucide-react";
import { startTransition, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { DataImportButton } from "@/blocks/data-table/data-import/data-import-button";
import { DataImportSection } from "@/blocks/data-table/data-import/data-import-section";
import { useDataImport } from "@/blocks/data-table/data-import/use-data-import";
import type { DataImportConfig } from "@/blocks/data-table/data-import/types";
import { PageFilters } from "@/components/page-filters/page-filters";
import { PageFilter } from "@/components/page-filters/page-filter";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useSheet } from "@/hooks/use-sheet";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import { useContextPanelInfo } from "../-context-panel/use-context-panel";
import { DefaultHeader } from "../-layout/default-header";
import { buildTagColumns, type TagRow } from "./-tags/tags-columns";
import { TagsFormSheet } from "./-tags/tags-form-sheet";

const tagsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   search: z.string().catch("").default(""),
   includeArchived: z.boolean().catch(false).default(false),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().min(1).max(100).catch(20).default(20),
});

function TagsInfoContent() {
   return (
      <ContextPanel className="h-auto shrink-0">
         <ContextPanelHeader>
            <ContextPanelTitle>O que são centros de custo?</ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent className="flex-none">
            <p className="text-sm text-muted-foreground px-2">
               Centros de custo organizam suas transações por setor, projeto ou
               responsabilidade. As palavras-chave habilitam categorização
               automática via IA.
            </p>
         </ContextPanelContent>
      </ContextPanel>
   );
}

const skeletonColumns = buildTagColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/tags",
)({
   validateSearch: tagsSearchSchema,
   loaderDeps: ({ search: { search, includeArchived, page, pageSize } }) => ({
      search,
      includeArchived,
      page,
      pageSize,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.tags.getAll.queryOptions({
            input: {
               search: deps.search || undefined,
               includeArchived: deps.includeArchived || undefined,
               page: deps.page,
               pageSize: deps.pageSize,
            },
         }),
      );
   },
   pendingMs: 300,
   pendingComponent: TagsSkeleton,
   head: () => ({
      meta: [{ title: "Centros de Custo — Montte" }],
   }),
   component: TagsPage,
});

function TagsSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function TagsList() {
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, search, includeArchived, page, pageSize } =
      Route.useSearch();
   const { generate: generateCsv, parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();
   const layout = useDataTableLayout("tags");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

   const { data: result } = useSuspenseQuery(
      orpc.tags.getAll.queryOptions({
         input: {
            search: search || undefined,
            includeArchived: includeArchived || undefined,
            page,
            pageSize,
         },
      }),
   );
   const { data: tags, total } = result;
   const pageCount = Math.max(1, Math.ceil(total / pageSize));

   const deleteMutation = useMutation(
      orpc.tags.remove.mutationOptions({
         onSuccess: () =>
            toast.success("Centro de custo excluído com sucesso."),
         onError: (e) =>
            toast.error(e.message || "Erro ao excluir centro de custo."),
      }),
   );
   const bulkDeleteMutation = useMutation(
      orpc.tags.bulkRemove.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao excluir centros de custo."),
      }),
   );
   const bulkArchiveMutation = useMutation(
      orpc.tags.bulkArchive.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao arquivar centros de custo."),
      }),
   );
   const archiveMutation = useMutation(
      orpc.tags.archive.mutationOptions({
         onSuccess: () => toast.success("Centro de custo arquivado."),
         onError: (e) =>
            toast.error(e.message || "Erro ao arquivar centro de custo."),
      }),
   );
   const unarchiveMutation = useMutation(
      orpc.tags.unarchive.mutationOptions({
         onSuccess: () => toast.success("Centro de custo reativado."),
         onError: (e) =>
            toast.error(e.message || "Erro ao reativar centro de custo."),
      }),
   );
   const bulkCreateMutation = useMutation(
      orpc.tags.bulkCreate.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao importar centros de custo."),
      }),
   );
   const updateMutation = useMutation(
      orpc.tags.update.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao atualizar centro de custo."),
      }),
   );

   const importConfig: DataImportConfig = useMemo(
      () => ({
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         mapRow: (row, i) => ({
            id: `__import_${i + 1}`,
            name: row.name ?? "",
            description: row.description?.trim() || null,
            isArchived: false,
            isDefault: false,
         }),
         template: {
            filename: "modelo-centros-de-custo.csv",
            label: "Baixar modelo CSV",
            description:
               "Inclui as colunas Nome e Descrição com exemplos de preenchimento.",
            createBlob: () =>
               generateCsv(
                  [
                     {
                        Nome: "Marketing",
                        Descrição: "Campanhas, mídia paga e eventos",
                     },
                     {
                        Nome: "Operações",
                        Descrição: "Custos recorrentes da operação",
                     },
                  ],
                  ["Nome", "Descrição"],
               ),
         },
         onImport: async (rows) => {
            const items = rows.map((r) => ({
               name: String(r.name ?? ""),
               description: r.description ? String(r.description).trim() : null,
            }));
            await bulkCreateMutation.mutateAsync({ items });
         },
      }),
      [bulkCreateMutation, generateCsv, parseCsv, parseXlsx],
   );

   const handleCreate = useCallback(() => {
      openSheet({ renderChildren: () => <TagsFormSheet /> });
   }, [openSheet]);

   const handleDelete = useCallback(
      (tag: TagRow) => {
         openAlertDialog({
            title: "Excluir centro de custo",
            description: `Tem certeza que deseja excluir o centro de custo "${tag.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: tag.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const handleArchive = useCallback(
      (tag: TagRow) => {
         openAlertDialog({
            title: "Arquivar centro de custo",
            description: `Tem certeza que deseja arquivar "${tag.name}"? Ele não aparecerá mais nas opções de seleção.`,
            actionLabel: "Arquivar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               await archiveMutation.mutateAsync({ id: tag.id });
            },
         });
      },
      [openAlertDialog, archiveMutation],
   );

   const handleUnarchive = useCallback(
      (tag: TagRow) => {
         openAlertDialog({
            title: "Reativar centro de custo",
            description: `Tem certeza que deseja reativar "${tag.name}"?`,
            actionLabel: "Reativar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               await unarchiveMutation.mutateAsync({ id: tag.id });
            },
         });
      },
      [openAlertDialog, unarchiveMutation],
   );

   const columns = useMemo<ColumnDef<TagRow>[]>(() => {
      const base = buildTagColumns({
         onUpdate: async (id, patch) => {
            await updateMutation.mutateAsync({ id, ...patch });
         },
      });
      const selectColumn: ColumnDef<TagRow> = {
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
      const actionsColumn: ColumnDef<TagRow> = {
         id: "__actions",
         size: 100,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true, align: "right" },
         cell: ({ row }) => {
            const tag = row.original;
            if (tag.isArchived) {
               return (
                  <div className="flex justify-end gap-2">
                     <Button
                        onClick={() => handleUnarchive(tag)}
                        size="icon-sm"
                        tooltip="Reativar"
                        variant="outline"
                     >
                        <ArchiveRestore />
                     </Button>
                     <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(tag)}
                        size="icon-sm"
                        tooltip="Excluir"
                        variant="outline"
                     >
                        <Trash2 />
                     </Button>
                  </div>
               );
            }
            return (
               <div className="flex justify-end gap-2">
                  <Button
                     onClick={() => handleArchive(tag)}
                     size="icon-sm"
                     tooltip="Arquivar"
                     variant="outline"
                  >
                     <Archive />
                  </Button>
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() => handleDelete(tag)}
                     size="icon-sm"
                     tooltip="Excluir"
                     variant="outline"
                  >
                     <Trash2 />
                  </Button>
               </div>
            );
         },
      };
      return [selectColumn, ...base, actionsColumn];
   }, [updateMutation, handleArchive, handleDelete, handleUnarchive]);

   const handleSortingChange = useCallback(
      (updater: SortingState | ((prev: SortingState) => SortingState)) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         startTransition(() => {
            navigate({
               search: (prev) => ({ ...prev, sorting: next, page: 1 }),
               replace: true,
            });
         });
      },
      [navigate, sorting],
   );

   const handlePaginationChange = useCallback(
      (
         updater:
            | PaginationState
            | ((prev: PaginationState) => PaginationState),
      ) => {
         const current: PaginationState = {
            pageIndex: page - 1,
            pageSize,
         };
         const next =
            typeof updater === "function" ? updater(current) : updater;
         startTransition(() => {
            navigate({
               search: (prev) => ({
                  ...prev,
                  page: next.pageIndex + 1,
                  pageSize: next.pageSize,
               }),
               replace: true,
            });
         });
      },
      [navigate, page, pageSize],
   );

   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const table = useReactTable({
      data: tags,
      columns,
      getRowId: (row) => row.id,
      pageCount,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      state: {
         sorting,
         columnFilters,
         pagination: { pageIndex: page - 1, pageSize },
         rowSelection,
      },
      onSortingChange: handleSortingChange,
      onPaginationChange: handlePaginationChange,
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
   });

   const importApi = useDataImport({ table, config: importConfig });

   const selectedRows = table.getSelectedRowModel().rows;
   const clearSelection = () => table.resetRowSelection();
   const archivableIds = selectedRows
      .filter((r) => !r.original.isDefault && !r.original.isArchived)
      .map((r) => r.original.id);
   const deletableIds = selectedRows
      .filter((r) => !r.original.isDefault)
      .map((r) => r.original.id);

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: clearSelection,
      children: (
         <>
            {archivableIds.length > 0 && (
               <SelectionActionButton
                  icon={<Archive />}
                  onClick={async () => {
                     await bulkArchiveMutation.mutateAsync({
                        ids: archivableIds,
                     });
                     toast.success(
                        `${archivableIds.length} ${archivableIds.length === 1 ? "centro de custo arquivado" : "centros de custo arquivados"}.`,
                     );
                     clearSelection();
                  }}
               >
                  Arquivar
               </SelectionActionButton>
            )}
            {deletableIds.length > 0 && (
               <SelectionActionButton
                  icon={<Trash2 />}
                  onClick={() => {
                     openAlertDialog({
                        title: `Excluir ${deletableIds.length} ${deletableIds.length === 1 ? "centro de custo" : "centros de custo"}`,
                        description:
                           "Tem certeza que deseja excluir os centros de custo selecionados? Esta ação não pode ser desfeita.",
                        actionLabel: "Excluir",
                        cancelLabel: "Cancelar",
                        variant: "destructive",
                        onAction: async () => {
                           await bulkDeleteMutation.mutateAsync({
                              ids: deletableIds,
                           });
                           toast.success(
                              `${deletableIds.length} ${deletableIds.length === 1 ? "centro de custo excluído" : "centros de custo excluídos"} com sucesso.`,
                           );
                           clearSelection();
                        },
                     });
                  }}
                  variant="destructive"
               >
                  Excluir
               </SelectionActionButton>
            )}
         </>
      ),
   });

   useContextPanelInfo(() => <TagsInfoContent />);

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  aria-label="Buscar centros de custo"
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  placeholder="Buscar centros de custo..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <PageFilters>
                     <PageFilter
                        active={includeArchived}
                        group="Filtros"
                        icon={<Archive className="size-4" />}
                        id="includeArchived"
                        label="Mostrar arquivados"
                        onToggle={(checked) =>
                           navigate({
                              search: (prev) => ({
                                 ...prev,
                                 includeArchived: checked,
                                 page: 1,
                              }),
                              replace: true,
                           })
                        }
                     />
                  </PageFilters>
                  <DataTableColumnVisibility table={table} />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     onClick={handleCreate}
                     size="icon-sm"
                     tooltip="Novo Centro de Custo"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Novo Centro de Custo</span>
                  </Button>
               </div>
            </div>
            <ScrollArea className="rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<TagRow> table={table} />
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
                        <Tag className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum centro de custo</EmptyTitle>
                     <EmptyDescription>
                        Adicione um centro de custo para categorizar suas
                        transações.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            )}
            <DataTablePagination table={table} />
         </div>
      </div>
   );
}

function TagsPage() {
   return (
      <main className="flex h-full flex-col gap-4">
         <DefaultHeader
            description="Gerencie seus centros de custo para categorizar transações"
            title="Centros de Custo"
         />
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<TagsSkeleton />}
               errorTitle="Erro ao carregar centros de custo"
            >
               <TagsList />
            </QueryBoundary>
         </div>
      </main>
   );
}
