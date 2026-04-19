import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Plus, Tag, Trash2 } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useMemo, useState } from "react";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { z } from "zod";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import { buildTagColumns, type TagRow } from "./-tags/tags-columns";

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
   const navigate = Route.useNavigate();
   const { search, includeArchived, page, pageSize } = Route.useSearch();
   const [isDraftActive, setIsDraftActive] = useState(false);

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
   const totalPages = Math.max(1, Math.ceil(total / pageSize));

   const deleteMutation = useMutation(
      orpc.tags.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Centro de custo excluído com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir centro de custo.");
         },
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.tags.bulkRemove.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir centros de custo.");
         },
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

   const createMutation = useMutation(
      orpc.tags.create.mutationOptions({
         onSuccess: () => toast.success("Centro de custo criado com sucesso."),
         onError: (e) =>
            toast.error(e.message || "Erro ao criar centro de custo."),
      }),
   );

   const updateMutation = useMutation(
      orpc.tags.update.mutationOptions({
         onError: (e) =>
            toast.error(e.message || "Erro ao atualizar centro de custo."),
      }),
   );

   const draftForm = useForm({
      defaultValues: {
         name: "",
         description: "",
         keywords: [] as string[],
      },
      onSubmit: async ({ value }) => {
         const result = await fromPromise(
            createMutation.mutateAsync({
               name: value.name,
               description: value.description.trim() || null,
               keywords: value.keywords.length > 0 ? value.keywords : undefined,
            }),
            (e) => e,
         );
         if (result.isOk()) {
            setIsDraftActive(false);
            draftForm.reset();
         }
      },
   });

   const handleCreate = useCallback(() => {
      draftForm.reset();
      setIsDraftActive(true);
   }, [draftForm]);

   const handleDiscardDraft = useCallback(() => {
      setIsDraftActive(false);
      draftForm.reset();
   }, [draftForm]);

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
         archiveMutation.mutate({ id: tag.id });
      },
      [archiveMutation],
   );

   const handleUnarchive = useCallback(
      (tag: TagRow) => {
         unarchiveMutation.mutate({ id: tag.id });
      },
      [unarchiveMutation],
   );

   const columns = useMemo(
      () =>
         buildTagColumns({
            onUpdate: async (id, patch) => {
               await updateMutation.mutateAsync({ id, ...patch });
            },
         }),
      [updateMutation],
   );

   return (
      <>
         <DataTableRoot
            addRowForm={isDraftActive ? draftForm : undefined}
            columns={columns}
            data={tags}
            getRowId={(row) => row.id}
            onDiscardAddRow={handleDiscardDraft}
            renderActions={({ row }) => {
               if (row.original.isArchived) {
                  return (
                     <>
                        <Button
                           onClick={() => handleUnarchive(row.original)}
                           tooltip="Reativar"
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
                     <Button
                        onClick={() => handleArchive(row.original)}
                        tooltip="Arquivar"
                        variant="outline"
                     >
                        <Archive />
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
            }}
            storageKey="montte:datatable:tags"
         >
            <DataTableToolbar
               searchPlaceholder="Buscar centros de custo..."
               searchDefaultValue={search}
               onSearch={(value) =>
                  navigate({
                     search: (prev) => ({ ...prev, search: value, page: 1 }),
                     replace: true,
                  })
               }
            >
               <Button
                  onClick={handleCreate}
                  tooltip="Novo Centro de Custo"
                  variant="outline"
                  size="icon-sm"
               >
                  <Plus />
                  <span className="sr-only">Novo Centro de Custo</span>
               </Button>
            </DataTableToolbar>
            <DataTableEmptyState>
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
            </DataTableEmptyState>
            <DataTableContent />
            <DataTableBulkActions<TagRow>>
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
      </>
   );
}

function TagsPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie seus centros de custo para categorizar transações"
            title="Centros de Custo"
         />
         <QueryBoundary
            fallback={<TagsSkeleton />}
            errorTitle="Erro ao carregar centros de custo"
         >
            <TagsList />
         </QueryBoundary>
      </main>
   );
}
