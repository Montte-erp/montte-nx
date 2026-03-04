import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   Archive,
   LayoutGrid,
   LayoutList,
   Pencil,
   Plus,
   Tag,
   Trash2,
} from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { buildTagColumns, type TagRow } from "@/features/tags/ui/tags-columns";
import { TagForm } from "@/features/tags/ui/tags-form";
import {
   useViewSwitch,
   type ViewConfig,
} from "@/features/view-switch/hooks/use-view-switch";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/tags",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.tags.getAll.queryOptions({}));
   },
   component: TagsPage,
});

const TAG_VIEWS: [ViewConfig<"table" | "card">, ViewConfig<"table" | "card">] =
   [
      { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
      { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
   ];

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

interface TagsListProps {
   view: "table" | "card";
}

function TagsList({ view }: TagsListProps) {
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

   const deleteMutation = useMutation(
      orpc.tags.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Tag excluída com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir tag.");
         },
      }),
   );

   const archiveMutation = useMutation(
      orpc.tags.archive.mutationOptions({
         onSuccess: () => toast.success("Tag arquivada."),
         onError: (e) => toast.error(e.message || "Erro ao arquivar tag."),
      }),
   );

   const handleEdit = useCallback(
      (tag: TagRow) => {
         openCredenza({
            children: (
               <TagForm mode="edit" onSuccess={closeCredenza} tag={tag} />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (tag: TagRow) => {
         openAlertDialog({
            title: "Excluir tag",
            description: `Tem certeza que deseja excluir a tag "${tag.name}"? Esta ação não pode ser desfeita.`,
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

   if (tags.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <Tag className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhuma tag</EmptyTitle>
               <EmptyDescription>
                  Adicione uma tag para categorizar suas transações.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   const columns = buildTagColumns();

   return (
      <DataTable
         columns={columns}
         data={tags}
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
         view={view}
      />
   );
}

// =============================================================================
// Page
// =============================================================================

function TagsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { currentView, setView, views } = useViewSwitch(
      "finance:tags:view",
      TAG_VIEWS,
   );

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
                  <Plus className="size-4 mr-1" />
                  Nova Tag
               </Button>
            }
            description="Gerencie suas tags para categorizar transações"
            title="Tags"
            viewSwitch={{ options: views, currentView, onViewChange: setView }}
         />
         <Suspense fallback={<TagsSkeleton />}>
            <TagsList view={currentView} />
         </Suspense>
      </main>
   );
}
