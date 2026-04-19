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
import { Archive, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
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
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { buildTagColumns, type TagRow } from "./-tags/tags-columns";
import { TagForm } from "./-tags/tags-form";

const skeletonColumns = buildTagColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/tags",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.tags.getAll.queryOptions({}));
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
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const [search, setSearch] = useState("");

   const handleCreate = useCallback(() => {
      openCredenza({
         renderChildren: () => (
            <TagForm mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [openCredenza, closeCredenza]);

   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

   const filteredTags = useMemo(() => {
      if (!search) return tags;
      const lower = search.toLowerCase();
      return tags.filter(
         (t) =>
            t.name.toLowerCase().includes(lower) ||
            (t.description?.toLowerCase().includes(lower) ?? false),
      );
   }, [tags, search]);

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

   const handleEdit = useCallback(
      (tag: TagRow) => {
         openCredenza({
            renderChildren: () => (
               <TagForm
                  mode="edit"
                  onSuccess={closeCredenza}
                  tag={{
                     id: tag.id,
                     name: tag.name,
                     color: tag.color,
                     description: tag.description,
                  }}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

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

   const columns = useMemo(() => buildTagColumns(), []);

   return (
      <DataTableRoot
         storageKey="montte:datatable:tags"
         columns={columns}
         data={filteredTags}
         getRowId={(row) => row.id}
         renderActions={({ row }) => (
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
         )}
      >
         <DataTableToolbar
            searchPlaceholder="Buscar centros de custo..."
            onSearch={setSearch}
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
                           icon={<Archive className="size-3.5" />}
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
                           icon={<Trash2 className="size-3.5" />}
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
   );
}

function TagsPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie seus centros de custo para categorizar transações"
            title="Centros de Custo"
         />
         <Suspense fallback={<TagsSkeleton />}>
            <TagsList />
         </Suspense>
      </main>
   );
}
