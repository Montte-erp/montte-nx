import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Spinner } from "@packages/ui/components/spinner";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
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

const skeletonColumns = buildCreditCardColumns();

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
   return <DataTableSkeleton columns={skeletonColumns} />;
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
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

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

   const handleEdit = useCallback(
      (card: CreditCardRow) => {
         openCredenza({
            renderChildren: () => (
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

   const columns = useMemo(() => buildCreditCardColumns(), []);

   return (
      <DataTableRoot
         columns={columns}
         data={result.data}
         getRowId={(row) => row.id}
         storageKey="montte:datatable:credit-cards"
         columnFilters={columnFilters}
         renderExpandedRow={(props) => (
            <CreditCardFaturaRow creditCardId={props.row.original.id} />
         )}
         onColumnFiltersChange={(updater) => {
            const next =
               typeof updater === "function" ? updater(columnFilters) : updater;
            const statusFilter = next.find((f) => f.id === "status");
            navigate({
               search: (prev) => ({
                  ...prev,
                  columnFilters: next,
                  status:
                     (statusFilter?.value as
                        | "active"
                        | "blocked"
                        | "cancelled") ?? undefined,
                  page: 1,
               }),
               replace: true,
            });
         }}
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
      >
         <DataTableToolbar />
         <DataTableEmptyState>
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
         </DataTableEmptyState>
         <DataTableContent />
         <DataTableBulkActions<CreditCardRow>>
            {({ selectedRows, clearSelection }) => (
               <SelectionActionButton
                  icon={<Trash2 className="size-3.5" />}
                  variant="destructive"
                  onClick={() => {
                     const ids = selectedRows.map((r) => r.id);
                     openAlertDialog({
                        title: `Excluir ${ids.length} ${ids.length === 1 ? "cartão" : "cartões"}`,
                        description:
                           "Tem certeza que deseja excluir os cartões selecionados? Esta ação não pode ser desfeita.",
                        actionLabel: "Excluir",
                        cancelLabel: "Cancelar",
                        variant: "destructive",
                        onAction: async () => {
                           await bulkDeleteMutation.mutateAsync({ ids });
                           clearSelection();
                        },
                     });
                  }}
               >
                  Excluir
               </SelectionActionButton>
            )}
         </DataTableBulkActions>
         <DataTablePagination
            currentPage={page}
            pageSize={pageSize}
            totalPages={result.totalPages}
            totalCount={result.totalCount}
            onPageChange={(p) =>
               navigate({
                  search: (prev) => ({ ...prev, page: p }),
                  replace: true,
               })
            }
            onPageSizeChange={(s) =>
               navigate({
                  search: (prev) => ({ ...prev, pageSize: s, page: 1 }),
                  replace: true,
               })
            }
         />
      </DataTableRoot>
   );
}

function CreditCardsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");

   function handleCreate() {
      openCredenza({
         renderChildren: () => (
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
         renderChildren: () => (
            <CreditCardsImportCredenza onClose={closeCredenza} />
         ),
      });
   }

   function handleExport() {
      openCredenza({
         renderChildren: () => (
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
               <Button onClick={handleCreate}>
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
