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
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnFiltersState, OnChangeFn, SortingState } from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { Archive, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { buildTagColumns, type TagRow } from "@/features/tags/ui/tags-columns";
import { TagForm } from "@/features/tags/ui/tags-form";
import { useAccountType } from "@/hooks/use-account-type";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDialogStack } from "@/hooks/use-dialog-stack";
import { orpc } from "@/integrations/orpc/client";

const tagsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .optional()
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .optional()
      .default([]),
});

export type TagsSearch = z.infer<typeof tagsSearchSchema>;

const [useTagsTableState] = createLocalStorageState<DataTableStoredState | null>(
   "montte:datatable:tags",
   null,
);

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/tags",
)({
   validateSearch: tagsSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.tags.getAll.queryOptions({}));
   },
   component: TagsPage,
});

// =============================================================================
// Skeleton
// =============================================================================

function TagsSkeleton() {
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

function TagsList() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters } = Route.useSearch();
   const [tableState, setTableState] = useTagsTableState();
   const { openDialogStack, closeDialogStack } = useDialogStack();
   const { openAlertDialog } = useAlertDialog();
   const { isBusiness } = useAccountType();

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next = typeof updater === "function" ? updater(sorting) : updater;
         navigate({ search: (prev: TagsSearch) => ({ ...prev, sorting: next }) });
      },
      [sorting, navigate],
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = useCallback(
      (updater) => {
         const next = typeof updater === "function" ? updater(columnFilters) : updater;
         navigate({ search: (prev: TagsSearch) => ({ ...prev, columnFilters: next }) });
      },
      [columnFilters, navigate],
   );

   const entityName = isBusiness ? "centro de custo" : "tag";

   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

   const deleteMutation = useMutation(
      orpc.tags.remove.mutationOptions({
         onSuccess: () => {
            toast.success(
               `${isBusiness ? "Centro de custo excluído" : "Tag excluída"} com sucesso.`,
            );
         },
         onError: (error) => {
            toast.error(error.message || `Erro ao excluir ${entityName}.`);
         },
      }),
   );

   const archiveMutation = useMutation(
      orpc.tags.archive.mutationOptions({
         onSuccess: () =>
            toast.success(
               `${isBusiness ? "Centro de custo arquivado" : "Tag arquivada"}.`,
            ),
         onError: (e) =>
            toast.error(e.message || `Erro ao arquivar ${entityName}.`),
      }),
   );

   const handleEdit = useCallback(
      (tag: TagRow) => {
         openDialogStack({
            children: (
               <TagForm mode="edit" onSuccess={closeDialogStack} tag={tag} />
            ),
         });
      },
      [openDialogStack, closeDialogStack],
   );

   const handleDelete = useCallback(
      (tag: TagRow) => {
         openAlertDialog({
            title: `Excluir ${entityName}`,
            description: `Tem certeza que deseja excluir ${isBusiness ? "o centro de custo" : "a tag"} "${tag.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: tag.id });
            },
         });
      },
      [openAlertDialog, deleteMutation, isBusiness, entityName],
   );

   const handleArchive = useCallback(
      (tag: TagRow) => {
         archiveMutation.mutate({ id: tag.id });
      },
      [archiveMutation],
   );

   if (tags.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <Tag className="size-6" />
               </EmptyMedia>
               <EmptyTitle>
                  {isBusiness ? "Nenhum centro de custo" : "Nenhuma tag"}
               </EmptyTitle>
               <EmptyDescription>
                  {isBusiness
                     ? "Adicione um centro de custo para categorizar suas transações."
                     : "Adicione uma tag para categorizar suas transações."}
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   const columns = buildTagColumns();

   return (
      <DataTable
         columns={columns}
         columnFilters={columnFilters}
         data={tags}
         getRowId={(row) => row.id}
         onColumnFiltersChange={handleColumnFiltersChange}
         onSortingChange={handleSortingChange}
         onTableStateChange={setTableState}
         sorting={sorting}
         tableState={tableState}
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
      />
   );
}

// =============================================================================
// Page
// =============================================================================

function TagsPage() {
   const { openDialogStack, closeDialogStack } = useDialogStack();
   const { isBusiness } = useAccountType();

   const handleCreate = useCallback(() => {
      openDialogStack({
         children: <TagForm mode="create" onSuccess={closeDialogStack} />,
      });
   }, [openDialogStack, closeDialogStack]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4 mr-1" />
                  {isBusiness ? "Novo Centro de Custo" : "Nova Tag"}
               </Button>
            }
            description={
               isBusiness
                  ? "Gerencie seus centros de custo para categorizar transações"
                  : "Gerencie suas tags para categorizar transações"
            }
            title={isBusiness ? "Centros de Custo" : "Tags"}
         />
         <Suspense fallback={<TagsSkeleton />}>
            <TagsList />
         </Suspense>
      </main>
   );
}
