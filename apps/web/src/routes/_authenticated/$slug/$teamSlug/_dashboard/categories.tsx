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
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
   type PaginationState,
   type RowSelectionState,
   type SortingState,
} from "@tanstack/react-table";
import {
   Archive,
   ArchiveRestore,
   ArrowLeftRight,
   FolderOpen,
   Plus,
   RefreshCw,
   Trash2,
   TrendingDown,
   TrendingUp,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import { startTransition, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "../-layout/default-header";
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

function parseCategoryType(raw: unknown): "income" | "expense" | "transfer" {
   const str = String(raw ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
   if (str === "income" || str === "expense" || str === "transfer") return str;
   if (str === "receita") return "income";
   if (str === "despesa") return "expense";
   if (str === "transferencia") return "transfer";
   return "expense";
}

const skeletonColumns = buildCategoryColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/categories",
)({
   validateSearch: categoriesSearchSchema,
   loaderDeps: ({
      search: { type, includeArchived, search, page, pageSize },
   }) => ({
      type,
      includeArchived,
      search,
      page,
      pageSize,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.categories.getPaginated.queryOptions({
            input: {
               type: deps.type,
               includeArchived: deps.includeArchived || undefined,
               search: deps.search || undefined,
               page: deps.page,
               pageSize: deps.pageSize,
            },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
   },
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
   const {
      sorting,
      columnFilters,
      search,
      type,
      includeArchived,
      page,
      pageSize,
   } = Route.useSearch();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx, generate: generateXlsx } = useXlsxFile();
   const layout = useDataTableLayout("categories");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

   const [{ data: result }, { data: categoryOptions }] = useSuspenseQueries({
      queries: [
         orpc.categories.getPaginated.queryOptions({
            input: {
               type,
               includeArchived: includeArchived || undefined,
               search: search || undefined,
               page,
               pageSize,
            },
         }),
         orpc.categories.getAll.queryOptions({}),
      ],
   });
   const { data: categories, total } = result;
   const pageCount = Math.max(1, Math.ceil(total / pageSize));

   const deleteMutation = useMutation(
      orpc.categories.remove.mutationOptions({
         onSuccess: () => toast.success("Categoria excluída com sucesso."),
         onError: (e) => toast.error(e.message || "Erro ao excluir categoria."),
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.categoriesBulk.bulkRemove.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao excluir categorias."),
      }),
   );

   const archiveMutation = useMutation(
      orpc.categories.archive.mutationOptions({
         onSuccess: () => toast.success("Categoria arquivada."),
         onError: (e) =>
            toast.error(e.message || "Erro ao arquivar categoria."),
      }),
   );

   const bulkArchiveMutation = useMutation(
      orpc.categoriesBulk.bulkArchive.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao arquivar categorias."),
      }),
   );

   const unarchiveMutation = useMutation(
      orpc.categories.unarchive.mutationOptions({
         onSuccess: () => toast.success("Categoria desarquivada."),
         onError: (e) =>
            toast.error(e.message || "Erro ao desarquivar categoria."),
      }),
   );

   const regenerateKeywordsMutation = useMutation(
      orpc.categories.regenerateKeywords.mutationOptions({
         meta: { skipGlobalInvalidation: true },
         onSuccess: () =>
            toast.success(
               "Geração de palavras-chave iniciada. Isso pode levar alguns segundos.",
            ),
         onError: (e) =>
            toast.error(e.message || "Erro ao gerar palavras-chave."),
      }),
   );

   const importBatchMutation = useMutation(
      orpc.categoriesBulk.importBatch.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao importar categorias."),
      }),
   );

   const updateMutation = useMutation(
      orpc.categories.update.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao atualizar categoria."),
      }),
   );

   const handleCreate = useCallback(() => {
      openSheet({
         renderChildren: () => (
            <CategoryFormSheet categories={categoryOptions} />
         ),
      });
   }, [categoryOptions, openSheet]);

   const handleUpdateCategory = useCallback(
      async (
         rowId: string,
         data: {
            name?: string;
            type?: "income" | "expense" | "transfer";
            parentId?: string | null;
         },
      ) => {
         await updateMutation.mutateAsync({ id: rowId, ...data });
      },
      [updateMutation],
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
            await importBatchMutation.mutateAsync({
               categories: importedRows.map((r) => ({
                  name: String(r.name ?? ""),
                  type: parseCategoryType(r.type),
                  participatesDre: false,
               })),
            });
         },
      }),
      [importBatchMutation, generateCsv, generateXlsx, parseCsv, parseXlsx],
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
               await deleteMutation.mutateAsync({ id: category.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const handleArchive = useCallback(
      (category: CategoryRow) => {
         openAlertDialog({
            title: "Arquivar categoria",
            description: `Arquivar "${category.name}" irá ocultá-la das listas e impedir novos lançamentos nesta categoria. Você poderá desarquivá-la a qualquer momento.`,
            actionLabel: "Arquivar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               await archiveMutation.mutateAsync({ id: category.id });
            },
         });
      },
      [openAlertDialog, archiveMutation],
   );

   const handleUnarchive = useCallback(
      (category: CategoryRow) => {
         openAlertDialog({
            title: "Desarquivar categoria",
            description: `Desarquivar "${category.name}" irá torná-la visível nas listas novamente e permitir novos lançamentos nesta categoria.`,
            actionLabel: "Desarquivar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               await unarchiveMutation.mutateAsync({ id: category.id });
            },
         });
      },
      [openAlertDialog, unarchiveMutation],
   );

   const columns = useMemo<ColumnDef<CategoryRow>[]>(() => {
      const base = buildCategoryColumns({
         categories: categoryOptions,
         onUpdate: handleUpdateCategory,
      });
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
                  {category.parentId === null && (
                     <Button
                        disabled={regenerateKeywordsMutation.isPending}
                        onClick={() =>
                           regenerateKeywordsMutation.mutate({
                              id: category.id,
                           })
                        }
                        size="icon-sm"
                        tooltip="Regerar palavras-chave"
                        variant="outline"
                     >
                        <RefreshCw />
                     </Button>
                  )}
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
      return [selectColumn, ...base, actionsColumn];
   }, [
      categoryOptions,
      handleUpdateCategory,
      handleArchive,
      handleDelete,
      handleUnarchive,
      regenerateKeywordsMutation,
   ]);

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
      data: categories,
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
                     const res = await fromPromise(
                        bulkArchiveMutation.mutateAsync({ ids: archivableIds }),
                        (e) => e,
                     );
                     if (res.isErr()) return;
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
                           await bulkDeleteMutation.mutateAsync({
                              ids: deletableIds,
                           });
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

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  aria-label="Buscar categorias..."
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  placeholder="Buscar categorias..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <PageFilters>
                     <PageFilter
                        active={includeArchived}
                        group="Filtros"
                        icon={<Archive className="size-4" />}
                        id="includeArchived"
                        label="Mostrar arquivadas"
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
                     <PageFilter
                        active={type === "income"}
                        group="Tipo"
                        icon={<TrendingUp className="size-4" />}
                        id="type-income"
                        label="Somente receitas"
                        onToggle={(checked) =>
                           navigate({
                              search: (prev) => ({
                                 ...prev,
                                 type: checked ? "income" : undefined,
                                 page: 1,
                              }),
                              replace: true,
                           })
                        }
                     />
                     <PageFilter
                        active={type === "expense"}
                        group="Tipo"
                        icon={<TrendingDown className="size-4" />}
                        id="type-expense"
                        label="Somente despesas"
                        onToggle={(checked) =>
                           navigate({
                              search: (prev) => ({
                                 ...prev,
                                 type: checked ? "expense" : undefined,
                                 page: 1,
                              }),
                              replace: true,
                           })
                        }
                     />
                     <PageFilter
                        active={type === "transfer"}
                        group="Tipo"
                        icon={<ArrowLeftRight className="size-4" />}
                        id="type-transfer"
                        label="Somente transferências"
                        onToggle={(checked) =>
                           navigate({
                              search: (prev) => ({
                                 ...prev,
                                 type: checked ? "transfer" : undefined,
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
                     tooltip="Nova Categoria"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Nova Categoria</span>
                  </Button>
               </div>
            </div>
            <ScrollArea className="rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<CategoryRow> table={table} />
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
                        <FolderOpen className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhuma categoria</EmptyTitle>
                     <EmptyDescription>
                        {type || search
                           ? "Nenhuma categoria encontrada com os filtros atuais."
                           : "Adicione uma categoria para organizar suas transações."}
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            )}
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
