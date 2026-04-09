import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useRowSelection } from "@packages/ui/hooks/use-row-selection";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import type {
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import {
   Archive,
   Download,
   FolderOpen,
   Pencil,
   Plus,
   Trash2,
   Upload,
} from "lucide-react";
import { Suspense, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import {
   buildCategoryColumns,
   type CategoryRow,
} from "./-categories/categories-columns";
import { CategoryForm } from "@/features/categories/ui/categories-form";
import { SubcategoryForm } from "@/features/categories/ui/subcategory-form";
import { CategoryFilterBar } from "./-categories/category-filter-bar";
import { CategoryImportDialogStack } from "./-categories/category-import-dialog-stack";
import { exportCategoriesCsv } from "./-categories/export-categories-csv";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

const categoriesSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .optional()
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .optional()
      .default([]),
   type: z.enum(["income", "expense"]).optional(),
   includeArchived: z.boolean().optional().default(false),
   groupBy: z.boolean().optional().default(true),
   search: z.string().optional().default(""),
});

export type CategoriesSearch = z.infer<typeof categoriesSearchSchema>;

const [useCategoriesTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:categories",
      null,
   );

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/categories",
)({
   validateSearch: categoriesSearchSchema,
   loader: ({ context }) => {
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

// =============================================================================
// Skeleton
// =============================================================================

function CategoriesSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// List
// =============================================================================

interface CategoriesListProps {
   navigate: ReturnType<typeof Route.useNavigate>;
}

function CategoriesList({ navigate }: CategoriesListProps) {
   const { sorting, columnFilters, type, includeArchived, groupBy, search } =
      Route.useSearch();
   const [tableState, setTableState] = useCategoriesTableState();

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         navigate({
            search: (prev: CategoriesSearch) => ({ ...prev, sorting: next }),
         });
      },
      [sorting, navigate],
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      useCallback(
         (updater) => {
            const next =
               typeof updater === "function" ? updater(columnFilters) : updater;
            navigate({
               search: (prev: CategoriesSearch) => ({
                  ...prev,
                  columnFilters: next,
               }),
            });
         },
         [columnFilters, navigate],
      );

   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const {
      rowSelection,
      onRowSelectionChange,
      selectedCount,
      selectedIds,
      onClear,
   } = useRowSelection();

   const { data: result } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({
         input: {
            type,
            includeArchived: includeArchived || undefined,
         },
      }),
   );

   const parentCategories: CategoryRow[] = result
      .filter((c) => c.parentId === null)
      .map((parent) => ({
         ...parent,
         subcategories: result.filter((c) => c.parentId === parent.id),
      }));

   const categories = search
      ? parentCategories.filter(
           (c) =>
              c.name.toLowerCase().includes(search.toLowerCase()) ||
              c.subcategories?.some((s) =>
                 s.name.toLowerCase().includes(search.toLowerCase()),
              ),
        )
      : parentCategories;

   const deleteMutation = useMutation(
      orpc.categories.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Categoria excluída com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir categoria.");
         },
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.categories.bulkRemove.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir categorias.");
         },
      }),
   );

   const archiveMutation = useMutation(
      orpc.categories.archive.mutationOptions({
         onSuccess: () => toast.success("Categoria arquivada."),
         onError: (e) =>
            toast.error(e.message || "Erro ao arquivar categoria."),
      }),
   );

   const handleEdit = useCallback(
      (category: CategoryRow) => {
         if (category.parentId !== null) {
            const parent = result.find((c) => c.id === category.parentId);
            openCredenza({
               children: (
                  <SubcategoryForm
                     mode="edit"
                     id={category.id}
                     name={category.name}
                     parentName={parent?.name ?? ""}
                     onSuccess={closeCredenza}
                  />
               ),
            });
            return;
         }
         openCredenza({
            children: (
               <CategoryForm
                  category={{
                     id: category.id,
                     name: category.name,
                     color: category.color,
                     icon: category.icon,
                     type: category.type,
                  }}
                  mode="edit"
                  onSuccess={closeCredenza}
               />
            ),
         });
      },
      [openCredenza, closeCredenza, result],
   );

   const handleAddSubcategory = useCallback(
      (category: CategoryRow) => {
         openCredenza({
            children: (
               <SubcategoryForm
                  mode="create"
                  onSuccess={closeCredenza}
                  parentId={category.id}
                  parentName={category.name}
                  parentType={category.type === "income" ? "income" : "expense"}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
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
         archiveMutation.mutate({ id: category.id });
      },
      [archiveMutation],
   );

   const handleBulkDelete = useCallback(() => {
      const deletableIds = selectedIds.filter(
         (id) => !categories.find((c) => c.id === id)?.isDefault,
      );
      if (deletableIds.length === 0) return;
      openAlertDialog({
         title: `Excluir ${deletableIds.length} ${deletableIds.length === 1 ? "categoria" : "categorias"}`,
         description:
            "Tem certeza que deseja excluir as categorias selecionadas? Esta ação não pode ser desfeita.",
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await bulkDeleteMutation.mutateAsync({ ids: deletableIds });
            toast.success(
               `${deletableIds.length} ${deletableIds.length === 1 ? "categoria excluída" : "categorias excluídas"} com sucesso.`,
            );
            onClear();
         },
      });
   }, [openAlertDialog, selectedIds, categories, bulkDeleteMutation, onClear]);

   const columns = useMemo(() => buildCategoryColumns(), []);

   if (categories.length === 0) {
      return (
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
      );
   }

   return (
      <>
         <DataTable
            columns={columns}
            data={categories}
            getRowId={(row) => row.id}
            getSubRows={(row) => row.subcategories}
            groupBy={groupBy ? (row) => row.type ?? "other" : undefined}
            onRowSelectionChange={onRowSelectionChange}
            renderGroupHeader={(key) => {
               if (key === "income") return "Receitas";
               if (key === "expense") return "Despesas";
               return "Outros";
            }}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            columnFilters={columnFilters}
            onColumnFiltersChange={handleColumnFiltersChange}
            tableState={tableState}
            onTableStateChange={setTableState}
            renderActions={({ row }) => {
               if (row.original.isDefault) return null;
               const isSub = row.original.parentId !== null;
               return (
                  <>
                     {!isSub && (
                        <Button
                           onClick={() => handleAddSubcategory(row.original)}
                           tooltip="Nova subcategoria"
                           variant="outline"
                        >
                           <Plus className="size-4" />
                        </Button>
                     )}
                     <Button
                        onClick={() => handleEdit(row.original)}
                        tooltip="Editar"
                        variant="outline"
                     >
                        <Pencil className="size-4" />
                     </Button>
                     {!isSub && (
                        <Button
                           onClick={() => handleArchive(row.original)}
                           tooltip="Arquivar"
                           variant="outline"
                        >
                           <Archive className="size-4" />
                        </Button>
                     )}
                     <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(row.original)}
                        tooltip="Excluir"
                        variant="outline"
                     >
                        <Trash2 className="size-4" />
                     </Button>
                  </>
               );
            }}
            rowSelection={rowSelection}
         />
         <SelectionActionBar onClear={onClear} selectedCount={selectedCount}>
            <SelectionActionButton
               icon={<Trash2 className="size-3.5" />}
               onClick={handleBulkDelete}
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}

// =============================================================================
// Page
// =============================================================================

function CategoriesPage() {
   const navigate = Route.useNavigate();
   const { type, includeArchived, groupBy, search } = Route.useSearch();
   const { openCredenza, closeCredenza } = useCredenza();

   const handleIncludeArchivedChange = useCallback(
      (checked: boolean) => {
         navigate({
            search: (prev: CategoriesSearch) => ({
               ...prev,
               includeArchived: checked,
            }),
         });
      },
      [navigate],
   );

   const handleGroupByChange = useCallback(
      (checked: boolean) => {
         navigate({
            search: (prev: CategoriesSearch) => ({ ...prev, groupBy: checked }),
         });
      },
      [navigate],
   );

   const handleSearchChange = useCallback(
      (value: string) => {
         navigate({
            search: (prev: CategoriesSearch) => ({ ...prev, search: value }),
         });
      },
      [navigate],
   );

   const handleClearFilters = useCallback(
      () =>
         navigate({
            search: (prev: CategoriesSearch) => ({
               ...prev,
               type: undefined,
               includeArchived: false,
               search: "",
            }),
         }),
      [navigate],
   );

   const handleCreate = useCallback(() => {
      openCredenza({
         children: <CategoryForm mode="create" onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   const handleImport = useCallback(() => {
      openCredenza({
         children: <CategoryImportDialogStack onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   const handleExport = useCallback(async () => {
      try {
         const data = await orpc.categories.exportAll.call({});
         exportCategoriesCsv(data);
         toast.success("Categorias exportadas com sucesso.");
      } catch {
         toast.error("Erro ao exportar categorias.");
      }
   }, []);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <div className="flex gap-2">
                  <Button onClick={handleImport} variant="outline">
                     <Upload className="size-4 " />
                     Importar
                  </Button>
                  <Button onClick={handleExport} variant="outline">
                     <Download className="size-4 " />
                     Exportar
                  </Button>
                  <Button onClick={handleCreate}>
                     <Plus className="size-4 " />
                     Nova Categoria
                  </Button>
               </div>
            }
            description="Gerencie as categorias das suas transações"
            title="Categorias"
         />
         <CategoryFilterBar
            groupBy={groupBy}
            includeArchived={includeArchived}
            onClear={handleClearFilters}
            onGroupByChange={handleGroupByChange}
            onIncludeArchivedChange={handleIncludeArchivedChange}
            onSearchChange={handleSearchChange}
            search={search}
            type={type}
         />
         <Suspense fallback={<CategoriesSkeleton />}>
            <CategoriesList navigate={navigate} />
         </Suspense>
      </main>
   );
}
