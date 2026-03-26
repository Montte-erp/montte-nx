import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
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
import { createFileRoute } from "@tanstack/react-router";
import {
   Archive,
   Download,
   FolderOpen,
   Pencil,
   Plus,
   Trash2,
   Upload,
} from "lucide-react";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   buildCategoryColumns,
   type CategoryRow,
} from "@/features/categories/ui/categories-columns";
import { CategoryForm } from "@/features/categories/ui/categories-form";
import {
   CategoryFilterBar,
   type CategoryFilters,
} from "@/features/categories/ui/category-filter-bar";
import { CategoryImportDialogStack } from "@/features/categories/ui/category-import-dialog-stack";
import { exportCategoriesCsv } from "@/features/categories/utils/export-categories-csv";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDialogStack } from "@/hooks/use-dialog-stack";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/categories",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
   },
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
   filters: CategoryFilters;
   onFiltersChange: (filters: CategoryFilters) => void;
}

function CategoriesList({ filters }: CategoriesListProps) {
   const { openDialogStack, closeDialogStack } = useDialogStack();
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
            type: filters.type,
            includeArchived: filters.includeArchived || undefined,
         },
      }),
   );

   const categories = result as unknown as CategoryRow[];

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

   const archiveMutation = useMutation(
      orpc.categories.archive.mutationOptions({
         onSuccess: () => toast.success("Categoria arquivada."),
         onError: (e) =>
            toast.error(e.message || "Erro ao arquivar categoria."),
      }),
   );

   const handleEdit = useCallback(
      (category: CategoryRow) => {
         openDialogStack({
            children: (
               <CategoryForm
                  category={{
                     id: category.id,
                     name: category.name,
                     color: category.color,
                     icon: category.icon,
                     keywords: category.keywords,
                     type: category.type,
                  }}
                  mode="edit"
                  onSuccess={closeDialogStack}
               />
            ),
         });
      },
      [openDialogStack, closeDialogStack],
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
            await Promise.all(
               deletableIds.map((id) => deleteMutation.mutateAsync({ id })),
            );
            onClear();
         },
      });
   }, [openAlertDialog, selectedIds, categories, deleteMutation, onClear]);

   const columns = buildCategoryColumns();

   if (categories.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <FolderOpen className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhuma categoria</EmptyTitle>
               <EmptyDescription>
                  {filters.search || filters.type
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
            enableRowSelection
            getRowId={(row) => row.id}
            onRowSelectionChange={onRowSelectionChange}
            renderActions={({ row }) => {
               if (row.original.isDefault) return null;
               return (
                  <>
                     <Button
                        onClick={() => handleEdit(row.original)}
                        tooltip="Editar"
                        variant="outline"
                     >
                        <Pencil className="size-4" />
                     </Button>
                     <Button
                        onClick={() => handleArchive(row.original)}
                        tooltip="Arquivar"
                        variant="outline"
                     >
                        <Archive className="size-4" />
                     </Button>
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
   const { openDialogStack, closeDialogStack } = useDialogStack();

   const [filters, setFilters] = useState<CategoryFilters>({
      search: "",
      type: undefined,
      includeArchived: false,
      page: 1,
   });

   const handleCreate = useCallback(() => {
      openDialogStack({
         children: <CategoryForm mode="create" onSuccess={closeDialogStack} />,
      });
   }, [openDialogStack, closeDialogStack]);

   const handleImport = useCallback(() => {
      openDialogStack({
         children: <CategoryImportDialogStack onSuccess={closeDialogStack} />,
      });
   }, [openDialogStack, closeDialogStack]);

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
                     <Upload className="size-4 mr-1" />
                     Importar
                  </Button>
                  <Button onClick={handleExport} variant="outline">
                     <Download className="size-4 mr-1" />
                     Exportar
                  </Button>
                  <Button onClick={handleCreate}>
                     <Plus className="size-4 mr-1" />
                     Nova Categoria
                  </Button>
               </div>
            }
            description="Gerencie as categorias das suas transações"
            title="Categorias"
         />
         <CategoryFilterBar filters={filters} onFiltersChange={setFilters} />
         <Suspense fallback={<CategoriesSkeleton />}>
            <CategoriesList filters={filters} onFiltersChange={setFilters} />
         </Suspense>
      </main>
   );
}
