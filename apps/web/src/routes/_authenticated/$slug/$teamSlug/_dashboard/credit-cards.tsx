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
import { Spinner } from "@packages/ui/components/spinner";
import { useRowSelection } from "@packages/ui/hooks/use-row-selection";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnFiltersState, OnChangeFn } from "@tanstack/react-table";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import {
   CreditCard,
   Download,
   Pencil,
   Plus,
   Trash2,
   Upload,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import {
   buildCreditCardColumns,
   type CreditCardRow,
} from "./-credit-cards/credit-cards-columns";
import { CreditCardForm } from "./-credit-cards/credit-cards-form";
import { CreditCardFaturaRow } from "./-credit-cards/credit-card-fatura-row";
import { CreditCardsExportCredenza } from "./-credit-cards/credit-cards-export-credenza";
import { CreditCardsImportCredenza } from "./-credit-cards/credit-cards-import-credenza";
import type { PanelAction } from "@/features/context-panel/context-panel-store";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { z } from "zod";

const creditCardsSearchSchema = z.object({
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   search: z.string().max(100).catch("").default(""),
   status: z
      .enum(["active", "blocked", "cancelled"])
      .optional()
      .catch(undefined),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

const [useCreditCardsTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:credit-cards",
      null,
   );

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/credit-cards",
)({
   validateSearch: creditCardsSearchSchema,
   loaderDeps: ({ search: { page, pageSize, search, status } }) => ({
      page,
      pageSize,
      search,
      status,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({
            input: {
               page: deps.page,
               pageSize: deps.pageSize,
               search: deps.search || undefined,
               status: deps.status,
            },
         }),
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
   const { columnFilters, page, pageSize, search, status } = Route.useSearch();
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

   const { data: result } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({
         input: { page, pageSize, search: search || undefined, status },
      }),
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

   const bulkDeleteMutation = useMutation(
      orpc.creditCards.bulkRemove.mutationOptions({
         onSuccess: ({ deleted }) => {
            toast.success(
               `${deleted} ${deleted === 1 ? "cartão excluído" : "cartões excluídos"} com sucesso.`,
            );
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir cartões.");
         },
      }),
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      useCallback(
         (updater) => {
            const next =
               typeof updater === "function"
                  ? updater(columnFilters as ColumnFiltersState)
                  : updater;
            navigate({
               search: (prev) => ({ ...prev, columnFilters: next }),
               replace: true,
            });
         },
         [navigate, columnFilters],
      );

   const handleEdit = useCallback(
      (card: CreditCardRow) => {
         openCredenza({
            children: (
               <QueryBoundary
                  fallback={<CreditCardFormSkeleton />}
                  errorTitle="Erro ao carregar cartão"
               >
                  <CreditCardForm
                     card={card}
                     mode="edit"
                     onSuccess={closeCredenza}
                  />
               </QueryBoundary>
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
            await bulkDeleteMutation.mutateAsync({ ids: selectedIds });
            onClear();
         },
      });
   }, [
      openAlertDialog,
      selectedCount,
      selectedIds,
      bulkDeleteMutation,
      onClear,
   ]);

   const columns = useMemo(() => buildCreditCardColumns(), []);

   if (result.data.length === 0 && page === 1) {
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
            data={result.data}
            getRowId={(row) => row.id}
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
            renderExpandedRow={(props) => (
               <CreditCardFaturaRow creditCardId={props.row.original.id} />
            )}
            pagination={{
               currentPage: page,
               pageSize,
               totalPages: result.totalPages,
               totalCount: result.totalCount,
               onPageChange: (p) =>
                  navigate({
                     search: (prev) => ({ ...prev, page: p }),
                     replace: true,
                  }),
               onPageSizeChange: (s) =>
                  navigate({
                     search: (prev) => ({ ...prev, pageSize: s, page: 1 }),
                     replace: true,
                  }),
            }}
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
   const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");

   function handleCreate() {
      openCredenza({
         children: (
            <QueryBoundary
               fallback={<CreditCardFormSkeleton />}
               errorTitle="Erro ao carregar formulário"
            >
               <CreditCardForm mode="create" onSuccess={closeCredenza} />
            </QueryBoundary>
         ),
      });
   }

   function handleImport() {
      openCredenza({
         children: <CreditCardsImportCredenza onClose={closeCredenza} />,
      });
   }

   function handleExport() {
      openCredenza({
         children: (
            <QueryBoundary
               fallback={
                  <div className="flex items-center justify-center py-4">
                     <Spinner className="size-4" />
                  </div>
               }
               errorTitle="Erro ao carregar cartões"
            >
               <CreditCardsExportCredenza
                  format={exportFormat}
                  onFormatChange={setExportFormat}
                  onClose={closeCredenza}
               />
            </QueryBoundary>
         ),
      });
   }

   const panelActions: PanelAction[] = [
      {
         icon: Upload,
         label: "Importar",
         onClick: handleImport,
      },
      {
         icon: Download,
         label: "Exportar",
         onClick: handleExport,
      },
   ];

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button
                  className="flex items-center gap-2"
                  onClick={handleCreate}
               >
                  <Plus className="size-4" />
                  Novo Cartão
               </Button>
            }
            panelActions={panelActions}
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
