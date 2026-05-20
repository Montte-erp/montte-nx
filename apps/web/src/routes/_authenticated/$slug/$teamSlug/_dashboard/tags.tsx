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
   type SortingState,
} from "@tanstack/react-table";
import {
   createCollection,
   eq,
   ilike,
   or,
   useLiveQuery,
} from "@tanstack/react-db";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Archive, ArchiveRestore, Plus, Tag, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
import { fromPromise } from "neverthrow";
import { z } from "zod";

import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { ExportButton } from "@/components/export-button/export-button";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { DataImportButton } from "@/blocks/data-table/data-import/data-import-button";
import { DataImportSection } from "@/blocks/data-table/data-import/data-import-section";
import { useDataImport } from "@/blocks/data-table/data-import/use-data-import";
import type { DataImportConfig } from "@/blocks/data-table/data-import/use-data-import";
import { PageFilters } from "@/components/page-filters/page-filters";
import { PageFilter } from "@/components/page-filters/page-filter";
import { useActiveTeam } from "@/hooks/use-active-team";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useSheet } from "@/hooks/use-sheet";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import {
   bulkArchiveTagsAction,
   bulkCreateTagsAction,
   bulkDeleteTagsAction,
   tagsCollectionOptions,
   unarchiveTagAction,
   updateTagAction,
} from "@/integrations/tanstack-db/tags";
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

const tagSortIdSchema = z.enum(["description", "isDefault", "name"]);

function normalizeTagSorting(sorting: SortingState) {
   const normalized: Array<{
      id: z.infer<typeof tagSortIdSchema>;
      desc: boolean;
   }> = [];
   for (const rule of sorting) {
      const result = tagSortIdSchema.safeParse(rule.id);
      if (!result.success) continue;
      normalized.push({ id: result.data, desc: rule.desc });
   }
   return normalized;
}

function getErrorMessage(error: unknown, fallback: string) {
   if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.length > 0
   ) {
      return error.message;
   }
   return fallback;
}

type LiveTagRow = TagRow & {
   $synced: boolean;
};

function tagDedupeKey(tag: TagRow) {
   return `${tag.teamId}:${tag.name.trim().toLocaleLowerCase()}`;
}

function removeConfirmedOptimisticDuplicates(tags: LiveTagRow[]) {
   const syncedKeys = new Set<string>();
   for (const tag of tags) {
      if (!tag.$synced) continue;
      syncedKeys.add(tagDedupeKey(tag));
   }
   return tags.filter(
      (tag) => tag.$synced || !syncedKeys.has(tagDedupeKey(tag)),
   );
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/tags",
)({
   validateSearch: tagsSearchSchema,
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
   const { activeTeamId } = useActiveTeam();
   const { queryClient } = Route.useRouteContext();
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, search, includeArchived, page, pageSize } =
      Route.useSearch();
   const { generate: generateCsv, parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();
   const layout = useDataTableLayout("tags-v2");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

   const tagsCollection = useMemo(
      () =>
         createCollection(
            tagsCollectionOptions({
               queryClient,
            }),
         ),
      [queryClient],
   );
   const { data: liveTags, isLoading } = useLiveQuery(
      (q) => {
         const pattern = `%${search.trim()}%`;
         const normalizedSorting = normalizeTagSorting(sorting);
         let query = q.from({ tag: tagsCollection });

         if (!includeArchived) {
            query = query.where(({ tag }) => eq(tag.isArchived, false));
         }

         if (search.trim()) {
            query = query.where(({ tag }) =>
               or(ilike(tag.name, pattern), ilike(tag.description, pattern)),
            );
         }

         if (normalizedSorting.length > 0) {
            for (const rule of normalizedSorting) {
               switch (rule.id) {
                  case "description":
                     query = query.orderBy(
                        ({ tag }) => tag.description,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "isDefault":
                     query = query.orderBy(
                        ({ tag }) => tag.isDefault,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
                  case "name":
                     query = query.orderBy(
                        ({ tag }) => tag.name,
                        rule.desc ? "desc" : "asc",
                     );
                     break;
               }
            }
         } else {
            query = query
               .orderBy(({ tag }) => tag.dreOrder, "asc")
               .orderBy(({ tag }) => tag.name, "asc")
               .orderBy(({ tag }) => tag.createdAt, "asc");
         }

         return query
            .limit(pageSize)
            .offset((page - 1) * pageSize)
            .select(({ tag }) => tag);
      },
      [includeArchived, page, pageSize, search, sorting, tagsCollection],
   );
   const tags = removeConfirmedOptimisticDuplicates(liveTags);

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
            isArchived: false,
            isDefault: false,
         }),
         template: {
            filename: "modelo-centros-de-custo.csv",
            label: "Baixar modelo CSV",
            description: "Inclui a coluna Nome com exemplos de preenchimento.",
            createBlob: () =>
               generateCsv(
                  [
                     {
                        Nome: "Marketing",
                     },
                     {
                        Nome: "Operações",
                     },
                  ],
                  ["Nome"],
               ),
         },
         onImport: async (rows) => {
            if (!activeTeamId) {
               toast.error("Time ativo não encontrado.");
               return;
            }
            const now = dayjs().toDate();
            const items: TagRow[] = rows.map((r) => ({
               id: crypto.randomUUID(),
               teamId: activeTeamId,
               name: String(r.name ?? ""),
               color: "#6366f1",
               description: null,
               isDefault: false,
               isArchived: false,
               dreType: null,
               dreOrder: null,
               createdAt: now,
               updatedAt: now,
            }));
            const bulkCreateTags = bulkCreateTagsAction(tagsCollection);
            const transaction = bulkCreateTags({ rows: items });
            const result = await fromPromise(
               transaction.isPersisted.promise,
               (error) => error,
            );
            if (result.isErr()) {
               toast.error(
                  getErrorMessage(
                     result.error,
                     "Erro ao importar centros de custo.",
                  ),
               );
               return;
            }
         },
      }),
      [activeTeamId, generateCsv, parseCsv, parseXlsx, tagsCollection],
   );

   const handleCreate = useCallback(() => {
      openSheet({
         renderChildren: () => (
            <TagsFormSheet collection={tagsCollection} teamId={activeTeamId} />
         ),
      });
   }, [activeTeamId, openSheet, tagsCollection]);

   const handleDelete = useCallback(
      (tag: TagRow) => {
         openAlertDialog({
            title: "Excluir centro de custo",
            description: `Tem certeza que deseja excluir o centro de custo "${tag.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               const bulkDeleteTags = bulkDeleteTagsAction(tagsCollection);
               const transaction = bulkDeleteTags({ ids: [tag.id] });
               const result = await fromPromise(
                  transaction.isPersisted.promise,
                  (error) => error,
               );
               if (result.isErr()) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao excluir centro de custo.",
                     ),
                  );
                  return;
               }
               toast.success("Centro de custo excluído com sucesso.");
            },
         });
      },
      [openAlertDialog, tagsCollection],
   );
   const handleArchive = useCallback(
      (tag: TagRow) => {
         openAlertDialog({
            title: "Arquivar centro de custo",
            description: `Tem certeza que deseja arquivar "${tag.name}"? Ele não aparecerá mais nas opções de seleção.`,
            actionLabel: "Arquivar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               const bulkArchiveTags = bulkArchiveTagsAction(tagsCollection);
               const transaction = bulkArchiveTags({ ids: [tag.id] });
               const result = await fromPromise(
                  transaction.isPersisted.promise,
                  (error) => error,
               );
               if (result.isErr()) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao arquivar centro de custo.",
                     ),
                  );
                  return;
               }
               toast.success("Centro de custo arquivado.");
            },
         });
      },
      [openAlertDialog, tagsCollection],
   );

   const handleUnarchive = useCallback(
      (tag: TagRow) => {
         openAlertDialog({
            title: "Reativar centro de custo",
            description: `Tem certeza que deseja reativar "${tag.name}"?`,
            actionLabel: "Reativar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               const unarchiveTag = unarchiveTagAction(tagsCollection);
               const transaction = unarchiveTag({ id: tag.id });
               const result = await fromPromise(
                  transaction.isPersisted.promise,
                  (error) => error,
               );
               if (result.isErr()) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao reativar centro de custo.",
                     ),
                  );
                  return;
               }
               toast.success("Centro de custo reativado.");
            },
         });
      },
      [openAlertDialog, tagsCollection],
   );

   const columns = useMemo<ColumnDef<TagRow>[]>(() => {
      const updateTag = updateTagAction(tagsCollection);
      const base = buildTagColumns({
         onUpdate: async (id, patch) => {
            const transaction = updateTag({ id, patch });
            const result = await fromPromise(
               transaction.isPersisted.promise,
               (error) => error,
            );
            if (result.isErr()) {
               toast.error(
                  getErrorMessage(
                     result.error,
                     "Erro ao atualizar centro de custo.",
                  ),
               );
            }
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
   }, [tagsCollection, handleArchive, handleDelete, handleUnarchive]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
      onUpdate: (next) =>
         navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
         }),
      totalRows: tags.length,
   });

   const table = useReactTable({
      data: tags,
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
            <SelectionActionButton
               disabled={archivableIds.length === 0}
               icon={<Archive />}
               onClick={async () => {
                  const bulkArchiveTags = bulkArchiveTagsAction(tagsCollection);
                  const transaction = bulkArchiveTags({ ids: archivableIds });
                  const result = await fromPromise(
                     transaction.isPersisted.promise,
                     (error) => error,
                  );
                  if (result.isErr()) {
                     toast.error(
                        getErrorMessage(
                           result.error,
                           "Erro ao arquivar centros de custo.",
                        ),
                     );
                     return;
                  }
                  toast.success(
                     `${archivableIds.length} ${archivableIds.length === 1 ? "centro de custo arquivado" : "centros de custo arquivados"}.`,
                  );
                  clearSelection();
               }}
            >
               Arquivar
            </SelectionActionButton>
            <SelectionActionButton
               disabled={deletableIds.length === 0}
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
                        const bulkDeleteTags =
                           bulkDeleteTagsAction(tagsCollection);
                        const transaction = bulkDeleteTags({
                           ids: deletableIds,
                        });
                        const result = await fromPromise(
                           transaction.isPersisted.promise,
                           (error) => error,
                        );
                        if (result.isErr()) {
                           toast.error(
                              getErrorMessage(
                                 result.error,
                                 "Erro ao excluir centros de custo.",
                              ),
                           );
                           return;
                        }
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
         </>
      ),
   });

   useContextPanelInfo(() => <TagsInfoContent />);

   if (isLoading) return <TagsSkeleton />;

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
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
                  <ExportButton table={table} fileBase="centros-custo" />
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
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<TagRow> table={table} />
                  <DataImportSection
                     api={importApi}
                     config={importConfig}
                     table={table}
                  />
               </Table>
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
            </ScrollArea>
            <DataTablePagination table={table} />
         </div>
      </div>
   );
}

function TagsPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
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
