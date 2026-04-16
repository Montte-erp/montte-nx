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
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Archive,
   ArchiveRestore,
   Download,
   MoreHorizontal,
   FolderOpen,
   Pencil,
   Plus,
   Trash2,
   Upload,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { fromPromise } from "neverthrow";
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
import { CategoryImportCredenza } from "./-categories/category-import-credenza";
import {
   buildExportRows,
   exportCategoriesCsv,
   EXPORT_HEADERS,
} from "./-categories/export-categories-csv";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useFileDownload } from "@/hooks/use-file-download";
import { orpc } from "@/integrations/orpc/client";
import { QueryBoundary } from "@/components/query-boundary";

const categoriesSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   type: z.enum(["income", "expense"]).optional(),
   includeArchived: z.boolean().catch(false).default(false),
   groupBy: z.boolean().catch(true).default(true),
   search: z.string().catch("").default(""),
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
   loaderDeps: ({ search: { type, includeArchived, search } }) => ({
      type,
      includeArchived,
      search,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({
            input: {
               type: deps.type,
               includeArchived: deps.includeArchived || undefined,
               search: deps.search || undefined,
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

function CategoriesTableSkeleton() {
   return (
      <div className="rounded-md border overflow-hidden">
         <div className="flex items-center gap-4 px-4 py-4 border-b bg-muted/30">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-10" />
            <div className="flex-1" />
            <Skeleton className="h-4 w-10" />
            <div className="flex gap-2">
               <Skeleton className="size-8 rounded" />
               <Skeleton className="size-8 rounded" />
               <Skeleton className="size-8 rounded" />
               <Skeleton className="size-8 rounded" />
            </div>
         </div>

         <div className="flex items-center gap-2 px-4 py-2 bg-muted/10 border-b">
            <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <Skeleton className="h-4 w-16" />
         </div>
         {[
            { w: "w-32", subs: 2 },
            { w: "w-44", subs: 0 },
            { w: "w-24", subs: 0 },
         ].map(({ w, subs }, i) => (
            <div key={`income-row-${i + 1}`}>
               <div className="flex items-center gap-4 px-4 py-4 border-b">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className={`h-4 ${w}`} />
                  <div className="flex-1" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <div className="flex gap-2">
                     <Skeleton className="size-8 rounded" />
                     <Skeleton className="size-8 rounded" />
                     <Skeleton className="size-8 rounded" />
                     <Skeleton className="size-8 rounded" />
                  </div>
               </div>
               {Array.from({ length: subs }).map((_, si) => (
                  <div
                     className="flex items-center gap-4 px-4 py-2 border-b pl-16 bg-muted/10"
                     key={`income-sub-${i + 1}-${si + 1}`}
                  >
                     <Skeleton className="size-4 rounded" />
                     <Skeleton className="h-4 w-28" />
                     <div className="flex-1" />
                     <div className="flex gap-2">
                        <Skeleton className="size-8 rounded" />
                        <Skeleton className="size-8 rounded" />
                     </div>
                  </div>
               ))}
            </div>
         ))}

         <div className="flex items-center gap-2 px-4 py-2 bg-muted/10 border-b">
            <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <Skeleton className="h-4 w-20" />
         </div>
         {[
            { w: "w-36", subs: 0 },
            { w: "w-28", subs: 1 },
            { w: "w-40", subs: 0 },
            { w: "w-24", subs: 0 },
         ].map(({ w, subs }, i) => (
            <div key={`expense-row-${i + 1}`}>
               <div className="flex items-center gap-4 px-4 py-4 border-b last:border-b-0">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className={`h-4 ${w}`} />
                  <div className="flex-1" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <div className="flex gap-2">
                     <Skeleton className="size-8 rounded" />
                     <Skeleton className="size-8 rounded" />
                     <Skeleton className="size-8 rounded" />
                     <Skeleton className="size-8 rounded" />
                  </div>
               </div>
               {Array.from({ length: subs }).map((_, si) => (
                  <div
                     className="flex items-center gap-4 px-4 py-2 border-b last:border-b-0 pl-16 bg-muted/10"
                     key={`expense-sub-${i + 1}-${si + 1}`}
                  >
                     <Skeleton className="size-4 rounded" />
                     <Skeleton className="h-4 w-28" />
                     <div className="flex-1" />
                     <div className="flex gap-2">
                        <Skeleton className="size-8 rounded" />
                        <Skeleton className="size-8 rounded" />
                     </div>
                  </div>
               ))}
            </div>
         ))}
      </div>
   );
}

function CategoriesSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
               <Skeleton className="h-8 w-36" />
               <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2">
               <Skeleton className="h-9 w-20 rounded-md" />
               <Skeleton className="h-9 w-9 rounded-md" />
               <Skeleton className="h-9 w-36 rounded-md" />
            </div>
         </div>
         <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
               <Skeleton className="h-9 flex-1" />
               <Skeleton className="h-9 w-64 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
               <Skeleton className="h-9 w-28 rounded-md" />
               <Skeleton className="h-9 w-32 rounded-md" />
            </div>
         </div>
         <CategoriesTableSkeleton />
      </div>
   );
}

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
            search: search || undefined,
         },
      }),
   );

   const parentCategories: CategoryRow[] = result
      .filter((c) => c.parentId === null)
      .map((parent) => ({
         ...parent,
         subcategories: result.filter((c) => c.parentId === parent.id),
      }));

   const categories = parentCategories;

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

   const handleEdit = useCallback(
      (category: CategoryRow) => {
         if (category.parentId !== null) {
            const parent = result.find((c) => c.id === category.parentId);
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
      [openCredenza, closeCredenza, result],
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

   const handleBulkArchive = useCallback(async () => {
      const archivableIds = selectedIds.filter((id) => {
         const cat = categories.find((c) => c.id === id);
         return cat !== undefined && !cat.isDefault;
      });
      if (archivableIds.length === 0) return;
      const result = await fromPromise(
         bulkArchiveMutation.mutateAsync({ ids: archivableIds }),
         (e) => e,
      );
      if (result.isErr()) return;
      toast.success(
         `${archivableIds.length} ${archivableIds.length === 1 ? "categoria arquivada" : "categorias arquivadas"}.`,
      );
      onClear();
   }, [selectedIds, categories, bulkArchiveMutation, onClear]);

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
            rowSelection={rowSelection}
         />
         <SelectionActionBar onClear={onClear} selectedCount={selectedCount}>
            <SelectionActionButton
               icon={<Archive />}
               onClick={handleBulkArchive}
            >
               Arquivar
            </SelectionActionButton>
            <SelectionActionButton
               icon={<Trash2 />}
               onClick={handleBulkDelete}
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}

function CategoriesPage() {
   return <CategoriesPageContent />;
}

function CategoriesPageContent() {
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
            replace: true,
         });
      },
      [navigate],
   );

   const handleGroupByChange = useCallback(
      (checked: boolean) => {
         navigate({
            search: (prev: CategoriesSearch) => ({ ...prev, groupBy: checked }),
            replace: true,
         });
      },
      [navigate],
   );

   const handleSearchChange = useCallback(
      (value: string) => {
         navigate({
            search: (prev: CategoriesSearch) => ({ ...prev, search: value }),
            replace: true,
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
            replace: true,
         }),
      [navigate],
   );

   const handleTypeChange = useCallback(
      (value: "income" | "expense" | undefined) => {
         navigate({
            search: (prev: CategoriesSearch) => ({ ...prev, type: value }),
            replace: true,
         });
      },
      [navigate],
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

   const { generate: generateXlsx } = useXlsxFile();
   const { download } = useFileDownload();

   const handleExport = useCallback(async () => {
      const result = await fromPromise(
         orpc.categories.exportAll.call({}),
         (e) => e,
      );
      if (result.isErr()) {
         toast.error("Erro ao exportar categorias.");
         return;
      }
      exportCategoriesCsv(result.value);
      toast.success("Categorias exportadas com sucesso.");
   }, []);

   const handleExportXlsx = useCallback(async () => {
      const result = await fromPromise(
         orpc.categories.exportAll.call({}),
         (e) => e,
      );
      if (result.isErr()) {
         toast.error("Erro ao exportar categorias.");
         return;
      }

      const rows = buildExportRows(result.value);
      const blob = generateXlsx(rows, [...EXPORT_HEADERS]);
      download(blob, "categorias.xlsx");
      toast.success("Categorias exportadas com sucesso.");
   }, [generateXlsx, download]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <div className="flex gap-2">
                  <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                        <Button
                           className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[state=open]:border-accent"
                           size="icon"
                           tooltip="Importar / Exportar"
                           variant="outline"
                        >
                           <MoreHorizontal />
                        </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleImport}>
                           <Upload />
                           Importar
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                           <DropdownMenuSubTrigger>
                              <Download />
                              Exportar
                           </DropdownMenuSubTrigger>
                           <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={handleExport}>
                                 CSV
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={handleExportXlsx}>
                                 XLSX
                              </DropdownMenuItem>
                           </DropdownMenuSubContent>
                        </DropdownMenuSub>
                     </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={handleCreate}>
                     <Plus />
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
            onTypeChange={handleTypeChange}
            search={search}
            type={type}
         />
         <QueryBoundary
            fallback={<CategoriesTableSkeleton />}
            errorTitle="Erro ao carregar categorias"
         >
            <CategoriesList navigate={navigate} />
         </QueryBoundary>
      </main>
   );
}
