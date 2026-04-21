import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   Archive,
   ArchiveRestore,
   FolderOpen,
   Layers,
   Pencil,
   Plus,
   RefreshCw,
   Trash2,
   TrendingDown,
   TrendingUp,
   Upload,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { QueryBoundary } from "@/components/query-boundary";
import { CategoryForm } from "@/features/categories/ui/categories-form";
import { SubcategoryForm } from "@/features/categories/ui/subcategory-form";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import {
   buildCategoryColumns,
   type CategoryRow,
} from "./-categories/categories-columns";
import { CategoryImportCredenza } from "./-categories/category-import-credenza";

const categoriesSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   type: z.enum(["income", "expense"]).optional().catch(undefined),
   includeArchived: z.boolean().catch(false).default(false),
   groupBy: z.boolean().catch(true).default(true),
   search: z.string().catch("").default(""),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().min(1).max(100).catch(20).default(20),
});

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
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const navigate = Route.useNavigate();
   const { search, type, includeArchived, groupBy, page, pageSize } =
      Route.useSearch();

   const { data: result } = useSuspenseQuery(
      orpc.categories.getPaginated.queryOptions({
         input: {
            type,
            includeArchived: includeArchived || undefined,
            search: search || undefined,
            page,
            pageSize,
         },
      }),
   );
   const { data: rows, total } = result;
   const totalPages = Math.max(1, Math.ceil(total / pageSize));

   const categories: CategoryRow[] = useMemo(
      () =>
         rows
            .filter((c) => c.parentId === null)
            .map((parent) => ({
               ...parent,
               subcategories: rows.filter((c) => c.parentId === parent.id),
            })),
      [rows],
   );

   const deleteMutation = useMutation(
      orpc.categories.remove.mutationOptions({
         onSuccess: () => toast.success("Categoria excluída com sucesso."),
         onError: (e) => toast.error(e.message || "Erro ao excluir categoria."),
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.categories.bulkRemove.mutationOptions({
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
      orpc.categories.bulkArchive.mutationOptions({
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

   const handleEdit = useCallback(
      (category: CategoryRow) => {
         if (category.parentId !== null) {
            const parent = rows.find((c) => c.id === category.parentId);
            openCredenza({
               renderChildren: () => (
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
            renderChildren: () => (
               <CategoryForm
                  category={{
                     id: category.id,
                     name: category.name,
                     color: category.color,
                     icon: category.icon,
                     type: category.type,
                     description: category.description,
                  }}
                  mode="edit"
                  onSuccess={closeCredenza}
               />
            ),
         });
      },
      [openCredenza, closeCredenza, rows],
   );

   const handleAddSubcategory = useCallback(
      (category: CategoryRow) => {
         openCredenza({
            renderChildren: () => (
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

   const handleCreate = useCallback(() => {
      openCredenza({
         renderChildren: () => (
            <CategoryForm mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [openCredenza, closeCredenza]);

   const handleImport = useCallback(() => {
      openCredenza({
         renderChildren: () => (
            <CategoryImportCredenza onSuccess={closeCredenza} />
         ),
      });
   }, [openCredenza, closeCredenza]);

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

   const columns = useMemo(() => buildCategoryColumns(), []);

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <DataTableRoot
            columns={columns}
            data={categories}
            getRowId={(row) => row.id}
            getSubRows={(row) => row.subcategories}
            groupBy={groupBy ? (row) => row.type ?? "other" : undefined}
            renderGroupHeader={(key) =>
               key === "income"
                  ? "Receitas"
                  : key === "expense"
                    ? "Despesas"
                    : "Outros"
            }
            renderActions={({ row }) => {
               if (row.original.isDefault) return null;
               const isSub = row.original.parentId !== null;
               const isArchived = row.original.isArchived;

               if (isArchived) {
                  return (
                     <>
                        <Button
                           onClick={() => handleUnarchive(row.original)}
                           tooltip="Desarquivar"
                           variant="outline"
                        >
                           <ArchiveRestore />
                        </Button>
                        <Button
                           className="text-destructive hover:text-destructive"
                           onClick={() => handleDelete(row.original)}
                           tooltip="Excluir"
                           variant="outline"
                        >
                           <Trash2 />
                        </Button>
                     </>
                  );
               }

               return (
                  <>
                     {!isSub && (
                        <Button
                           onClick={() => handleAddSubcategory(row.original)}
                           tooltip="Nova subcategoria"
                           variant="outline"
                        >
                           <Plus />
                        </Button>
                     )}
                     <Button
                        onClick={() => handleEdit(row.original)}
                        tooltip="Editar"
                        variant="outline"
                     >
                        <Pencil />
                     </Button>
                     {!isSub && (
                        <Button
                           disabled={regenerateKeywordsMutation.isPending}
                           onClick={() =>
                              regenerateKeywordsMutation.mutate({
                                 id: row.original.id,
                              })
                           }
                           tooltip="Regerar palavras-chave"
                           variant="outline"
                        >
                           <RefreshCw />
                        </Button>
                     )}
                     {!isSub && (
                        <Button
                           onClick={() => handleArchive(row.original)}
                           tooltip="Arquivar"
                           variant="outline"
                        >
                           <Archive />
                        </Button>
                     )}
                     <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(row.original)}
                        tooltip="Excluir"
                        variant="outline"
                     >
                        <Trash2 />
                     </Button>
                  </>
               );
            }}
            storageKey="montte:datatable:categories"
         >
            <DataTableExternalFilter
               id="includeArchived"
               label="Mostrar arquivadas"
               group="Filtros"
               active={includeArchived}
               renderIcon={() => <Archive className="size-4" />}
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
            <DataTableExternalFilter
               id="type-income"
               label="Somente receitas"
               group="Tipo"
               active={type === "income"}
               renderIcon={() => <TrendingUp className="size-4" />}
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
            <DataTableExternalFilter
               id="type-expense"
               label="Somente despesas"
               group="Tipo"
               active={type === "expense"}
               renderIcon={() => <TrendingDown className="size-4" />}
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
            <DataTableExternalFilter
               id="groupBy"
               label="Agrupar por tipo"
               group="Exibição"
               active={groupBy}
               renderIcon={() => <Layers className="size-4" />}
               onToggle={(checked) =>
                  navigate({
                     search: (prev) => ({ ...prev, groupBy: checked }),
                     replace: true,
                  })
               }
            />
            <DataTableToolbar
               searchPlaceholder="Buscar categorias..."
               searchDefaultValue={search}
               onSearch={(value) =>
                  navigate({
                     search: (prev) => ({ ...prev, search: value, page: 1 }),
                     replace: true,
                  })
               }
            >
               <Button
                  onClick={handleImport}
                  tooltip="Importar"
                  variant="outline"
                  size="icon-sm"
               >
                  <Upload />
                  <span className="sr-only">Importar</span>
               </Button>
               <Button
                  onClick={handleCreate}
                  tooltip="Nova Categoria"
                  variant="outline"
                  size="icon-sm"
               >
                  <Plus />
                  <span className="sr-only">Nova Categoria</span>
               </Button>
            </DataTableToolbar>
            <DataTableEmptyState>
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
            </DataTableEmptyState>
            <DataTableContent className="flex-1 overflow-auto min-h-0" />
            <DataTableBulkActions<CategoryRow>>
               {({ selectedRows, clearSelection }) => {
                  const archivableIds = selectedRows
                     .filter((r) => !r.isDefault && !r.isArchived)
                     .map((r) => r.id);
                  const deletableIds = selectedRows
                     .filter((r) => !r.isDefault)
                     .map((r) => r.id);
                  return (
                     <>
                        {archivableIds.length > 0 && (
                           <SelectionActionButton
                              icon={<Archive />}
                              onClick={async () => {
                                 const res = await fromPromise(
                                    bulkArchiveMutation.mutateAsync({
                                       ids: archivableIds,
                                    }),
                                    (e) => e,
                                 );
                                 if (res.isErr()) return;
                                 toast.success(
                                    `${archivableIds.length} ${archivableIds.length === 1 ? "categoria arquivada" : "categorias arquivadas"}.`,
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
                  );
               }}
            </DataTableBulkActions>
         </DataTableRoot>
         <DataTablePagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={total}
            pageSize={pageSize}
            onPageChange={(newPage) =>
               navigate({
                  search: (prev) => ({ ...prev, page: newPage }),
                  replace: true,
               })
            }
            onPageSizeChange={(newPageSize) =>
               navigate({
                  search: (prev) => ({
                     ...prev,
                     pageSize: newPageSize,
                     page: 1,
                  }),
                  replace: true,
               })
            }
         />
      </div>
   );
}

function CategoriesPage() {
   return (
      <main className="flex h-full flex-col gap-4">
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
