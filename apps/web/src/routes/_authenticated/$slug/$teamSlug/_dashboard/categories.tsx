import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
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
import { createCollection, eq, ilike, useLiveQuery } from "@tanstack/react-db";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
   getCoreRowModel,
   getExpandedRowModel,
   useReactTable,
   type ColumnDef,
   type ExpandedState,
   type SortingState,
} from "@tanstack/react-table";
import {
   Archive,
   ArchiveRestore,
   ChevronDown,
   ChevronRight,
   FolderOpen,
   Plus,
   Trash2,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { DefaultHeader } from "../-layout/default-header";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableFilterChips } from "@/blocks/data-table/data-table-filter-chips";
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
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useSheet } from "@/hooks/use-sheet";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useActiveTeam } from "@/hooks/use-active-team";
import {
   archiveCategoryAction,
   bulkArchiveCategoriesAction,
   bulkDeleteCategoriesAction,
   categoriesCollectionOptions,
   deleteCategoryAction,
   importCategoriesAction,
   unarchiveCategoryAction,
   updateCategoryAction,
} from "@/integrations/tanstack-db/categories";
import { CategoryFormSheet } from "./-categories/category-form-sheet";
import {
   buildCategoryColumns,
   type CategoryRow,
} from "./-categories/categories-columns";

const categoriesSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   type: z.enum(["income", "expense", "transfer"]).optional().catch(undefined),
   includeArchived: z.boolean().catch(false).default(false),
   search: z.string().catch("").default(""),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().min(1).max(100).catch(20).default(20),
});

function parseCategoryType(
   raw: unknown,
): "income" | "expense" | "transfer" | undefined {
   const str = String(raw ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
   if (str === "income" || str === "expense" || str === "transfer") return str;
   if (str === "receita") return "income";
   if (str === "despesa") return "expense";
   if (str === "transferencia") return "transfer";
   return undefined;
}

const skeletonColumns = buildCategoryColumns();

const categorySortIdSchema = z.enum(["isDefault", "name", "type"]);

function normalizeCategorySorting(sorting: SortingState) {
   const normalized: Array<{
      id: z.infer<typeof categorySortIdSchema>;
      desc: boolean;
   }> = [];
   for (const rule of sorting) {
      const result = categorySortIdSchema.safeParse(rule.id);
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

function compareCategoryValues(
   left: CategoryRow,
   right: CategoryRow,
   sortId: z.infer<typeof categorySortIdSchema>,
) {
   switch (sortId) {
      case "isDefault":
         return Number(left.isDefault) - Number(right.isDefault);
      case "name":
         return left.name.localeCompare(right.name, "pt-BR");
      case "type":
         return left.type.localeCompare(right.type, "pt-BR");
   }
}

type LiveCategoryRow = CategoryRow & {
   $synced: boolean;
};

function categoryDedupeKey(category: CategoryRow) {
   return `${category.teamId}:${category.type}:${category.parentId ?? "root"}:${category.name.trim().toLocaleLowerCase()}`;
}

function removeConfirmedOptimisticDuplicates(categories: LiveCategoryRow[]) {
   const syncedKeys = new Set<string>();
   for (const category of categories) {
      if (!category.$synced) continue;
      syncedKeys.add(categoryDedupeKey(category));
   }
   return categories.filter(
      (category) =>
         category.$synced || !syncedKeys.has(categoryDedupeKey(category)),
   );
}

function sortCategories(rows: CategoryRow[], sorting: SortingState) {
   const normalized = normalizeCategorySorting(sorting);
   return [...rows].sort((left, right) => {
      for (const rule of normalized) {
         const result = compareCategoryValues(left, right, rule.id);
         if (result !== 0) return rule.desc ? -result : result;
      }
      const nameResult = left.name.localeCompare(right.name, "pt-BR");
      if (nameResult !== 0) return nameResult;
      return dayjs(right.createdAt).valueOf() - dayjs(left.createdAt).valueOf();
   });
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/categories",
)({
   validateSearch: categoriesSearchSchema,
   pendingMs: 300,
   pendingComponent: CategoriesSkeleton,
   head: () => ({
      meta: [{ title: "Categorias — Montte" }],
   }),
   component: CategoriesPage,
});

function CategoriesSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function CategoriesList() {
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx, generate: generateXlsx } = useXlsxFile();
   const { activeTeamId } = useActiveTeam();
   const { queryClient } = Route.useRouteContext();
   const layout = useDataTableLayout("categories");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

   const categoriesCollection = useMemo(
      () =>
         createCollection(
            categoriesCollectionOptions({
               queryClient,
               teamId: activeTeamId ?? "no-team",
            }),
         ),
      [activeTeamId, queryClient],
   );

   const hasSearch = search.trim().length > 0;
   const { data: liveCategories, isLoading } = useLiveQuery(
      (q) => {
         let query = q.from({ category: categoriesCollection });

         query = query.where(({ category }) => eq(category.isArchived, false));

         if (hasSearch) {
            query = query.where(({ category }) =>
               ilike(category.name, `%${search.trim()}%`),
            );
         }

         const nameFilterValue = columnFilters.find(
            (filter) => filter.id === "name",
         )?.value;
         if (typeof nameFilterValue === "string" && nameFilterValue.trim()) {
            query = query.where(({ category }) =>
               ilike(category.name, `%${nameFilterValue.trim()}%`),
            );
         }

         const typeFilterValue = columnFilters.find(
            (filter) => filter.id === "type",
         )?.value;
         if (typeof typeFilterValue === "string" && typeFilterValue.trim()) {
            query = query.where(({ category }) =>
               eq(category.type, typeFilterValue.trim()),
            );
         }

         return query.select(({ category }) => category);
      },
      [categoriesCollection, columnFilters, hasSearch, search],
   );

   const { data: liveParentableCategories } = useLiveQuery(
      (q) =>
         q
            .from({ category: categoriesCollection })
            .where(({ category }) => eq(category.isArchived, false))
            .select(({ category }) => category),
      [categoriesCollection],
   );

   const categories = removeConfirmedOptimisticDuplicates(liveCategories);
   const parentableCategories = removeConfirmedOptimisticDuplicates(
      liveParentableCategories,
   );

   const sortedCategories = useMemo(
      () => sortCategories(categories, sorting),
      [categories, sorting],
   );
   const rootCandidates = useMemo(
      () =>
         hasSearch
            ? sortedCategories
            : sortedCategories.filter((category) => !category.parentId),
      [hasSearch, sortedCategories],
   );
   const total = rootCandidates.length;
   const rootCategories = useMemo(
      () => rootCandidates.slice((page - 1) * pageSize, page * pageSize),
      [page, pageSize, rootCandidates],
   );
   const childrenByParent = useMemo(() => {
      const m = new Map<string, CategoryRow[]>();
      if (hasSearch) return m;
      for (const cat of sortedCategories) {
         if (!cat.parentId) continue;
         const list = m.get(cat.parentId);
         if (list) list.push(cat);
         else m.set(cat.parentId, [cat]);
      }
      return m;
   }, [hasSearch, sortedCategories]);

   const [expanded, setExpanded] = useState<ExpandedState>({});

   const handleCreate = useCallback(() => {
      openSheet({
         renderChildren: () => (
            <CategoryFormSheet
               categories={parentableCategories}
               collection={categoriesCollection}
               teamId={activeTeamId}
            />
         ),
      });
   }, [activeTeamId, categoriesCollection, openSheet, parentableCategories]);

   const handleUpdateCategory = useCallback(
      async (
         rowId: string,
         data: {
            name?: string;
            parentId?: string | null;
            icon?: string | null;
            color?: string | null;
         },
      ) => {
         const updateCategory = updateCategoryAction(categoriesCollection);
         const transaction = updateCategory({ id: rowId, patch: data });
         const result = await fromPromise(
            transaction.isPersisted.promise,
            (error) => error,
         );
         if (result.isErr()) {
            toast.error(
               getErrorMessage(result.error, "Erro ao atualizar categoria."),
            );
         }
      },
      [categoriesCollection],
   );

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
            id: `__import_${i + 1}`,
            name: String(row.name ?? "").trim(),
            type: parseCategoryType(row.type),
         }),
         template: {
            label: "Baixar modelo",
            description:
               "Inclui Nome e Tipo. Use Tipo como Receita, Despesa ou Transferência.",
            formats: [
               {
                  filename: "modelo-categorias.csv",
                  label: "CSV",
                  createBlob: () =>
                     generateCsv(
                        [
                           { Nome: "Vendas", Tipo: "Receita" },
                           { Nome: "Aluguel", Tipo: "Despesa" },
                           {
                              Nome: "Transferência entre contas",
                              Tipo: "Transferência",
                           },
                        ],
                        ["Nome", "Tipo"],
                     ),
               },
               {
                  filename: "modelo-categorias.xlsx",
                  label: "XLSX",
                  createBlob: () =>
                     generateXlsx(
                        [
                           { Nome: "Vendas", Tipo: "Receita" },
                           { Nome: "Aluguel", Tipo: "Despesa" },
                           {
                              Nome: "Transferência entre contas",
                              Tipo: "Transferência",
                           },
                        ],
                        ["Nome", "Tipo"],
                     ),
               },
            ],
         },
         onImport: async (importedRows) => {
            const invalidRows = importedRows.filter(
               (row) => parseCategoryType(row.type) === undefined,
            );
            if (invalidRows.length > 0) {
               const message = `Planilha inválida: ${invalidRows.length} linha(s) com tipo ausente ou inválido.`;
               return Promise.reject({ message });
            }

            const importCategories =
               importCategoriesAction(categoriesCollection);
            const categoriesPayload = importedRows
               .map((row) => {
                  const type = parseCategoryType(row.type);
                  if (!type) return null;
                  return {
                     name: String(row.name ?? "").trim(),
                     type,
                     participatesDre: false,
                  };
               })
               .filter((entry) => entry !== null);

            const result = await fromPromise(
               importCategories({
                  categories: categoriesPayload,
               }),
               (error) => error,
            );
            if (result.isErr()) {
               const message = getErrorMessage(
                  result.error,
                  "Erro ao importar categorias.",
               );
               return Promise.reject({ message });
            }
         },
      }),
      [categoriesCollection, generateCsv, generateXlsx, parseCsv, parseXlsx],
   );

   const handleDelete = useCallback(
      (category: CategoryRow) => {
         openAlertDialog({
            title: "Excluir categoria",
            description: `Tem certeza que deseja excluir a categoria "${category.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               const deleteCategory =
                  deleteCategoryAction(categoriesCollection);
               const transaction = deleteCategory({ id: category.id });
               const result = await fromPromise(
                  transaction.isPersisted.promise,
                  (error) => error,
               );
               if (result.isErr()) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao excluir categoria.",
                     ),
                  );
                  return;
               }
               toast.success("Categoria excluída com sucesso.");
            },
         });
      },
      [categoriesCollection, openAlertDialog],
   );

   const handleArchive = useCallback(
      (category: CategoryRow) => {
         openAlertDialog({
            title: "Arquivar categoria",
            description: `Arquivar "${category.name}" irá ocultá-la das listas e impedir novos lançamentos nesta categoria. Você poderá desarquivá-la a qualquer momento.`,
            actionLabel: "Arquivar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               const archiveCategory =
                  archiveCategoryAction(categoriesCollection);
               const transaction = archiveCategory({ id: category.id });
               const result = await fromPromise(
                  transaction.isPersisted.promise,
                  (error) => error,
               );
               if (result.isErr()) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao arquivar categoria.",
                     ),
                  );
                  return;
               }
               toast.success("Categoria arquivada.");
            },
         });
      },
      [categoriesCollection, openAlertDialog],
   );

   const handleUnarchive = useCallback(
      (category: CategoryRow) => {
         openAlertDialog({
            title: "Desarquivar categoria",
            description: `Desarquivar "${category.name}" irá torná-la visível nas listas novamente e permitir novos lançamentos nesta categoria.`,
            actionLabel: "Desarquivar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               const unarchiveCategory =
                  unarchiveCategoryAction(categoriesCollection);
               const transaction = unarchiveCategory({ id: category.id });
               const result = await fromPromise(
                  transaction.isPersisted.promise,
                  (error) => error,
               );
               if (result.isErr()) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao desarquivar categoria.",
                     ),
                  );
                  return;
               }
               toast.success("Categoria desarquivada.");
            },
         });
      },
      [categoriesCollection, openAlertDialog],
   );

   const columns = useMemo<ColumnDef<CategoryRow>[]>(() => {
      const base = buildCategoryColumns({
         categories,
         onUpdate: handleUpdateCategory,
      });
      const expandColumn: ColumnDef<CategoryRow> = {
         id: "__expand",
         size: 36,
         enableSorting: false,
         enableHiding: false,
         header: () => null,
         cell: ({ row }) =>
            row.getCanExpand() ? (
               <Button
                  aria-label={row.getIsExpanded() ? "Recolher" : "Expandir"}
                  onClick={row.getToggleExpandedHandler()}
                  size="icon-sm"
                  variant="ghost"
               >
                  {row.getIsExpanded() ? (
                     <ChevronDown className="size-4" />
                  ) : (
                     <ChevronRight className="size-4" />
                  )}
               </Button>
            ) : (
               <span className="inline-block size-7" aria-hidden />
            ),
      };
      const selectColumn: ColumnDef<CategoryRow> = {
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
      const actionsColumn: ColumnDef<CategoryRow> = {
         id: "__actions",
         size: 140,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => {
            const category = row.original;
            if (category.isArchived) {
               return (
                  <div className="flex justify-end gap-2">
                     <Button
                        onClick={() => handleUnarchive(category)}
                        size="icon-sm"
                        tooltip="Desarquivar"
                        variant="outline"
                     >
                        <ArchiveRestore />
                     </Button>
                     <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(category)}
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
                     onClick={() => handleArchive(category)}
                     size="icon-sm"
                     tooltip="Arquivar"
                     variant="outline"
                  >
                     <Archive />
                  </Button>
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() => handleDelete(category)}
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
      return [selectColumn, expandColumn, ...base, actionsColumn];
   }, [
      categories,
      handleUpdateCategory,
      handleArchive,
      handleDelete,
      handleUnarchive,
   ]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
      onUpdate: (next) =>
         navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
         }),
      totalRows: total,
   });

   const table = useReactTable({
      data: rootCategories,
      columns,
      getRowId: (row) => row.id,
      rowCount: total,
      pageCount: urlState.pageCount,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      state: { ...urlState.state, ...layout.state, expanded },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      onExpandedChange: setExpanded,
      getSubRows: (row) => childrenByParent.get(row.id),
      getRowCanExpand: (row) => (childrenByParent.get(row.id)?.length ?? 0) > 0,
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
   });

   const importApi = useDataImport({ table, config: importConfig });

   const selectedRows = table.getSelectedRowModel().rows;
   const archivableIds = selectedRows
      .filter((r) => !r.original.isArchived)
      .map((r) => r.original.id);
   const deletableIds = selectedRows.map((r) => r.original.id);

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <>
            {archivableIds.length > 0 && (
               <SelectionActionButton
                  icon={<Archive />}
                  onClick={async () => {
                     const bulkArchiveCategories =
                        bulkArchiveCategoriesAction(categoriesCollection);
                     const transaction = bulkArchiveCategories({
                        ids: archivableIds,
                     });
                     const result = await fromPromise(
                        transaction.isPersisted.promise,
                        (error) => error,
                     );
                     if (result.isErr()) {
                        toast.error(
                           getErrorMessage(
                              result.error,
                              "Erro ao arquivar categorias.",
                           ),
                        );
                        return;
                     }
                     toast.success(
                        `${archivableIds.length} ${archivableIds.length === 1 ? "categoria arquivada" : "categorias arquivadas"}.`,
                     );
                     table.resetRowSelection();
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
                        title: `Excluir ${deletableIds.length} ${deletableIds.length === 1 ? "categoria" : "categorias"}`,
                        description:
                           "Tem certeza que deseja excluir as categorias selecionadas? Esta ação não pode ser desfeita.",
                        actionLabel: "Excluir",
                        cancelLabel: "Cancelar",
                        variant: "destructive",
                        onAction: async () => {
                           const bulkDeleteCategories =
                              bulkDeleteCategoriesAction(categoriesCollection);
                           const transaction = bulkDeleteCategories({
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
                                    "Erro ao excluir categorias.",
                                 ),
                              );
                              return;
                           }
                           toast.success(
                              `${deletableIds.length} ${deletableIds.length === 1 ? "categoria excluída" : "categorias excluídas"} com sucesso.`,
                           );
                           table.resetRowSelection();
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

   if (isLoading) return <CategoriesSkeleton />;

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar categorias..."
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  placeholder="Buscar categorias..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="categorias" />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     onClick={handleCreate}
                     size="icon-sm"
                     tooltip="Nova Categoria"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Nova Categoria</span>
                  </Button>
               </div>
            </div>
            <DataTableFilterChips table={table} />
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<CategoryRow> table={table} />
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
                           <FolderOpen className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhuma categoria</EmptyTitle>
                        <EmptyDescription>
                           {columnFilters.length > 0 || search
                              ? "Nenhuma categoria encontrada com os filtros atuais."
                              : "Adicione uma categoria para organizar suas transações."}
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

function CategoriesPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Gerencie as categorias das suas transações"
            title="Categorias"
         />
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<CategoriesSkeleton />}
               errorTitle="Erro ao carregar categorias"
            >
               <CategoriesList />
            </QueryBoundary>
         </div>
      </main>
   );
}
