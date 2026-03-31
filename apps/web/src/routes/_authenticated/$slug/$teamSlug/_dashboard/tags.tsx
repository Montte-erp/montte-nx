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
import type { ColumnFiltersState, OnChangeFn, SortingState } from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { Archive, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { Suspense, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { buildTagColumns, type TagRow } from "./-tags/tags-columns";
import { TagForm } from "./-tags/tags-form";

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
      <div className="flex flex-col gap-3">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// List
// =============================================================================

interface TagsListProps {
   navigate: ReturnType<typeof Route.useNavigate>;
}

function TagsList({ navigate }: TagsListProps) {
   const { sorting, columnFilters } = Route.useSearch();
   const [tableState, setTableState] = useTagsTableState();

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next = typeof updater === "function" ? updater(sorting) : updater;
         navigate({ search: (prev) => ({ ...prev, sorting: next }) });
      },
      [sorting, navigate],
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = useCallback(
      (updater) => {
         const next = typeof updater === "function" ? updater(columnFilters) : updater;
         navigate({ search: (prev) => ({ ...prev, columnFilters: next }) });
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

   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

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

   const archiveMutation = useMutation(
      orpc.tags.archive.mutationOptions({
         onSuccess: () => toast.success("Centro de custo arquivado."),
         onError: (e) => toast.error(e.message || "Erro ao arquivar centro de custo."),
      }),
   );

   const handleEdit = useCallback(
      (tag: TagRow) => {
         openCredenza({
            children: (
               <TagForm
                  mode="edit"
                  onSuccess={closeCredenza}
                  tag={{ id: tag.id, name: tag.name, color: tag.color, description: tag.description }}
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

   const handleBulkDelete = useCallback(() => {
      if (selectedIds.length === 0) return;
      openAlertDialog({
         title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "centro de custo" : "centros de custo"}`,
         description: "Tem certeza que deseja excluir os centros de custo selecionados? Esta ação não pode ser desfeita.",
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await bulkDeleteMutation.mutateAsync({ ids: selectedIds });
            toast.success(
               `${selectedIds.length} ${selectedIds.length === 1 ? "centro de custo excluído" : "centros de custo excluídos"} com sucesso.`,
            );
            onClear();
         },
      });
   }, [openAlertDialog, selectedIds, bulkDeleteMutation, onClear]);

   if (tags.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <Tag className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhum centro de custo</EmptyTitle>
               <EmptyDescription>
                  Adicione um centro de custo para categorizar suas transações.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   const columns = useMemo(() => buildTagColumns(), []);

   return (
      <>
         <DataTable
            columns={columns}
            data={tags}
            getRowId={(row) => row.id}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            columnFilters={columnFilters}
            onColumnFiltersChange={handleColumnFiltersChange}
            tableState={tableState}
            onTableStateChange={setTableState}
            rowSelection={rowSelection}
            onRowSelectionChange={onRowSelectionChange}
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

function TagsPage() {
   const navigate = Route.useNavigate();
   const { openCredenza, closeCredenza } = useCredenza();

   const handleCreate = useCallback(() => {
      openCredenza({
         children: <TagForm mode="create" onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4" />
                  Novo Centro de Custo
               </Button>
            }
            description="Gerencie seus centros de custo para categorizar transações"
            title="Centros de Custo"
         />
         <Suspense fallback={<TagsSkeleton />}>
            <TagsList navigate={navigate} />
         </Suspense>
      </main>
   );
}
