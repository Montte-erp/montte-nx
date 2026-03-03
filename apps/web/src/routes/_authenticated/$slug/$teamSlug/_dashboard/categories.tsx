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
import { FolderOpen, LayoutGrid, LayoutList, Plus, Trash2 } from "lucide-react";
import { Suspense, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   buildCategoryColumns,
   type CategoryRow,
} from "@/features/categories/ui/categories-columns";
import { CategoryForm } from "@/features/categories/ui/categories-form";
import {
   useViewSwitch,
   type ViewConfig,
} from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
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

const CATEGORY_VIEWS: [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

// =============================================================================
// Skeleton
// =============================================================================

function CategoriesSkeleton() {
   return (
      <div className="space-y-3">
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
   view: "table" | "card";
}

function CategoriesList({ view }: CategoriesListProps) {
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const {
      rowSelection,
      onRowSelectionChange,
      selectedCount,
      selectedIds,
      onClear,
   } = useRowSelection();

   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const expanded = useMemo(
      () =>
         Object.fromEntries(
            categories
               .filter((c) => c.subcategories.length > 0)
               .map((c) => [c.id, true]),
         ),
      [categories],
   );

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
      if (deletableIds.length === 0) {
         return;
      }
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

   const columns = buildCategoryColumns(
      handleEdit,
      handleDelete,
      handleArchive,
   );

   if (categories.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <FolderOpen className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhuma categoria</EmptyTitle>
               <EmptyDescription>
                  Adicione uma categoria para organizar suas transações.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   if (view === "card") {
      return (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((category) => (
               <div
                  className="rounded-lg border bg-background p-4 space-y-3"
                  key={category.id}
               >
                  <div className="flex items-center gap-2 min-w-0">
                     {category.color && (
                        <span
                           className="size-4 rounded-full shrink-0"
                           style={{ backgroundColor: category.color }}
                        />
                     )}
                     <p className="font-medium truncate">{category.name}</p>
                  </div>
                  {!category.isDefault && (
                     <div className="flex items-center gap-2">
                        <Button
                           onClick={() => handleEdit(category)}
                           variant="outline"
                        >
                           Editar
                        </Button>
                        <Button
                           className="text-destructive"
                           onClick={() => handleDelete(category)}
                           variant="ghost"
                        >
                           Excluir
                        </Button>
                     </div>
                  )}
               </div>
            ))}
         </div>
      );
   }

   return (
      <>
         <DataTable
            columns={columns}
            data={categories}
            enableRowSelection
            getRowCanExpand={(row) => row.original.subcategories.length > 0}
            getRowId={(row) => row.id}
            initialExpanded={expanded}
            onRowSelectionChange={onRowSelectionChange}
            renderMobileCard={({ row }) => (
               <div className="rounded-lg border bg-background p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                     <div className="flex items-center gap-2 min-w-0">
                        {row.original.color && (
                           <span
                              className="size-4 rounded-full shrink-0"
                              style={{ backgroundColor: row.original.color }}
                           />
                        )}
                        <p className="font-medium truncate">
                           {row.original.name}
                        </p>
                     </div>
                  </div>
                  {!row.original.isDefault && (
                     <div className="flex items-center gap-2">
                        <Button
                           onClick={() => handleEdit(row.original)}
                           variant="outline"
                        >
                           Editar
                        </Button>
                        <Button
                           className="text-destructive"
                           onClick={() => handleDelete(row.original)}
                           variant="ghost"
                        >
                           Excluir
                        </Button>
                     </div>
                  )}
               </div>
            )}
            renderSubComponent={({ row }) => {
               const subs = row.original.subcategories;
               if (subs.length === 0) return null;
               return (
                  <div className="flex flex-col gap-1 pl-10 py-1">
                     {subs.map((sub) => (
                        <span
                           className="text-sm text-muted-foreground"
                           key={sub.id}
                        >
                           {sub.name}
                        </span>
                     ))}
                  </div>
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
   const { openCredenza, closeCredenza } = useCredenza();
   const { currentView, setView, views } = useViewSwitch(
      "finance:categories:view",
      CATEGORY_VIEWS,
   );

   const handleCreate = useCallback(() => {
      openCredenza({
         children: <CategoryForm mode="create" onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4 mr-1" />
                  Nova Categoria
               </Button>
            }
            description="Gerencie as categorias das suas transações"
            title="Categorias"
            viewSwitch={
               <ViewSwitchDropdown
                  currentView={currentView}
                  onViewChange={setView}
                  views={views}
               />
            }
         />
         <Suspense fallback={<CategoriesSkeleton />}>
            <CategoriesList view={currentView} />
         </Suspense>
      </main>
   );
}
