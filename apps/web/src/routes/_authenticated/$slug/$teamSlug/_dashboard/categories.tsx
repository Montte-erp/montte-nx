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
   Plus,
   RefreshCw,
   Trash2,
   TrendingDown,
   TrendingUp,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
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
   const { openAlertDialog } = useAlertDialog();
   const navigate = Route.useNavigate();
   const { search, type, includeArchived, groupBy, page, pageSize } =
      Route.useSearch();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

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

   const categories: CategoryRow[] = rows;

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

   const createMutation = useMutation(
      orpc.categories.create.mutationOptions({
         onSuccess: () => toast.success("Categoria criada com sucesso."),
         onError: (e) => toast.error(e.message || "Erro ao criar categoria."),
      }),
   );

   const updateMutation = useMutation(
      orpc.categories.update.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao atualizar categoria."),
      }),
   );

   const [isDraftActive, setIsDraftActive] = useState(false);
   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddCategory = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         const categoryType = String(data.type ?? "") as "income" | "expense";
         if (!name || !categoryType) return;
         await createMutation.mutateAsync({
            name,
            type: categoryType,
            participatesDre: false,
         });
         setIsDraftActive(false);
      },
      [createMutation],
   );

   const handleUpdateCategory = useCallback(
      async (
         rowId: string,
         data: { name?: string; type?: "income" | "expense" },
      ) => {
         await updateMutation.mutateAsync({ id: rowId, ...data });
      },
      [updateMutation],
   );

   const importConfig: DataTableImportConfig = useMemo(
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
         mapRow: (row): Record<string, unknown> => ({
            name: String(row.name ?? "").trim(),
            type:
               String(row.type ?? "expense") === "income"
                  ? "income"
                  : "expense",
         }),
         onImport: async (importedRows) => {
            await Promise.allSettled(
               importedRows.map((r) =>
                  createMutation.mutateAsync({
                     name: String(r.name ?? ""),
                     type: (String(r.type ?? "expense") === "income"
                        ? "income"
                        : "expense") as "income" | "expense",
                     participatesDre: false,
                  }),
               ),
            );
         },
      }),
      [createMutation, parseCsv, parseXlsx],
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

   const columns = useMemo(
      () => buildCategoryColumns({ onUpdate: handleUpdateCategory }),
      [handleUpdateCategory],
   );

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <DataTableRoot
            columns={columns}
            data={categories}
            getRowId={(row) => row.id}
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

               const isSub = row.original.parentId !== null;

               return (
                  <>
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
            isDraftRowActive={isDraftActive}
            onAddRow={handleAddCategory}
            onDiscardAddRow={handleDiscardDraft}
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
               <DataTableImportButton importConfig={importConfig} />
               <Button
                  onClick={() => setIsDraftActive(true)}
                  tooltip="Nova Categoria"
                  variant="outline"
                  size="icon-sm"
               >
                  <Plus />
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
