import { Button } from "@packages/ui/components/button";
import {
   DataTable,
   type DataTableStoredState,
} from "@packages/ui/components/data-table";
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
import type {
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { Suspense, useCallback } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import {
   buildCreditCardColumns,
   type CreditCardRow,
} from "@/features/credit-cards/ui/credit-cards-columns";
import { CreditCardForm } from "@/features/credit-cards/ui/credit-cards-form";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { tableSearchSchema } from "@/lib/table-search-schema";
import { z } from "zod";

const [useCreditCardsTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:credit-cards",
      null,
   );

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/credit-cards",
)({
   validateSearch: tableSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
   },
   pendingMs: 300,
   pendingComponent: CreditCardsSkeleton,
   head: () => ({
      meta: [{ title: "Cartões de Crédito — Montte" }],
   }),
   component: CreditCardsPage,
});

function CreditCardsSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

function CreditCardFormSkeleton() {
   return (
      <div className="flex flex-col gap-4 p-4">
         <Skeleton className="h-4 w-32" />
         <Skeleton className="h-10 w-full" />
         <Skeleton className="h-4 w-24" />
         <Skeleton className="h-10 w-full" />
         <Skeleton className="h-4 w-28" />
         <Skeleton className="h-10 w-full" />
      </div>
   );
}

function CreditCardsList() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters } = Route.useSearch();
   const [tableState, setTableState] = useCreditCardsTableState();
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

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next =
            typeof updater === "function"
               ? updater(sorting as SortingState)
               : updater;
         navigate({
            search: (prev: z.infer<typeof tableSearchSchema>) => ({
               ...prev,
               sorting: next,
            }),
            replace: true,
         });
      },
      [navigate, sorting],
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      useCallback(
         (updater) => {
            const next =
               typeof updater === "function"
                  ? updater(columnFilters as ColumnFiltersState)
                  : updater;
            navigate({
               search: (prev: z.infer<typeof tableSearchSchema>) => ({
                  ...prev,
                  columnFilters: next,
               }),
               replace: true,
            });
         },
         [navigate, columnFilters],
      );

   const handleEdit = useCallback(
      (card: CreditCardRow) => {
         openCredenza({
            children: (
               <ErrorBoundary
                  FallbackComponent={createErrorFallback({
                     errorTitle: "Erro ao carregar cartão",
                  })}
               >
                  <Suspense fallback={<CreditCardFormSkeleton />}>
                     <CreditCardForm
                        card={card}
                        mode="edit"
                        onSuccess={closeCredenza}
                     />
                  </Suspense>
               </ErrorBoundary>
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
            getRowId={(row) => row.id}
            sorting={sorting as SortingState}
            onSortingChange={handleSortingChange}
            columnFilters={columnFilters as ColumnFiltersState}
            onColumnFiltersChange={handleColumnFiltersChange}
            tableState={tableState}
            onTableStateChange={setTableState}
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

   function handleCreate() {
      openCredenza({
         children: (
            <ErrorBoundary
               FallbackComponent={createErrorFallback({
                  errorTitle: "Erro ao carregar formulário",
               })}
            >
               <Suspense fallback={<CreditCardFormSkeleton />}>
                  <CreditCardForm mode="create" onSuccess={closeCredenza} />
               </Suspense>
            </ErrorBoundary>
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
         />
         <QueryBoundary
            fallback={<CreditCardsSkeleton />}
            errorTitle="Erro ao carregar cartões"
         >
            <CreditCardsList />
         </QueryBoundary>
      </main>
   );
}
