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
   CreditCard,
   LayoutGrid,
   LayoutList,
   Pencil,
   Plus,
   Trash2,
} from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   buildCreditCardColumns,
   type CreditCardRow,
} from "@/features/credit-cards/ui/credit-cards-columns";
import { CreditCardForm } from "@/features/credit-cards/ui/credit-cards-form";
import {
   useViewSwitch,
   type ViewConfig,
} from "@/features/view-switch/hooks/use-view-switch";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/credit-cards",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
   },
   component: CreditCardsPage,
});

const CREDIT_CARD_VIEWS: [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

function CreditCardsSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

interface CreditCardsListProps {
   view: "table" | "card";
}

function CreditCardsList({ view }: CreditCardsListProps) {
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const {
      rowSelection,
      onRowSelectionChange,
      selectedCount,
      selectedIds,
      onClear,
   } = useRowSelection();

   const { data: cards } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({}),
   );

   const deleteMutation = useMutation(
      orpc.creditCards.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Cartão de crédito excluído com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir cartão de crédito.");
         },
      }),
   );

   const handleEdit = useCallback(
      (card: CreditCardRow) => {
         openCredenza({
            children: (
               <Suspense fallback={null}>
                  <CreditCardForm
                     card={card}
                     mode="edit"
                     onSuccess={closeCredenza}
                  />
               </Suspense>
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (card: CreditCardRow) => {
         openAlertDialog({
            title: "Excluir cartão de crédito",
            description: `Tem certeza que deseja excluir o cartão "${card.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: card.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const handleBulkDelete = useCallback(() => {
      openAlertDialog({
         title: `Excluir ${selectedCount} ${selectedCount === 1 ? "cartão" : "cartões"}`,
         description:
            "Tem certeza que deseja excluir os cartões selecionados? Esta ação não pode ser desfeita.",
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await Promise.all(
               selectedIds.map((id) => deleteMutation.mutateAsync({ id })),
            );
            onClear();
         },
      });
   }, [openAlertDialog, selectedCount, selectedIds, deleteMutation, onClear]);

   const columns = buildCreditCardColumns();

   if (cards.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <CreditCard className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhum cartão de crédito</EmptyTitle>
               <EmptyDescription>
                  Adicione um cartão de crédito para controlar seus gastos.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   return (
      <>
         <DataTable
            columns={columns}
            data={cards}
            enableRowSelection
            getRowId={(row) => row.id}
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
                     className="text-destructive hover:text-destructive"
                     onClick={() => handleDelete(row.original)}
                     tooltip="Excluir"
                     variant="outline"
                  >
                     <Trash2 className="size-4" />
                  </Button>
               </>
            )}
            rowSelection={rowSelection}
            view={view}
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

function CreditCardsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { currentView, setView, views } = useViewSwitch(
      "finance:credit-cards:view",
      CREDIT_CARD_VIEWS,
   );

   function handleCreate() {
      openCredenza({
         children: (
            <Suspense fallback={null}>
               <CreditCardForm mode="create" onSuccess={closeCredenza} />
            </Suspense>
         ),
      });
   }

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4 mr-1" />
                  Novo Cartão
               </Button>
            }
            description="Gerencie seus cartões de crédito"
            title="Cartões de Crédito"
            viewSwitch={{ options: views, currentView, onViewChange: setView }}
         />
         <Suspense fallback={<CreditCardsSkeleton />}>
            <CreditCardsList view={currentView} />
         </Suspense>
      </main>
   );
}
