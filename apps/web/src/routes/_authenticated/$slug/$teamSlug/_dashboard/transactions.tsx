import { Button } from "@packages/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Plus, Upload } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { DefaultHeader } from "@/components/default-header";
import type { PanelAction } from "@/features/context-panel/context-panel-store";
import { useTransactionPrerequisites } from "@/features/transactions/hooks/use-transaction-prerequisites";
import { TransactionDialogStack } from "@/features/transactions/ui/transaction-dialog-stack";
import { TransactionExportDialogStack } from "@/features/transactions/ui/transaction-export-dialog-stack";
import {
   DEFAULT_FILTERS,
   TransactionFilterBar,
   type TransactionFilters,
} from "@/features/transactions/ui/transaction-filter-bar";
import { TransactionImportDialogStack } from "@/features/transactions/ui/transaction-import-dialog-stack";
import { TransactionPrerequisitesBlocker } from "@/features/transactions/ui/transaction-prerequisites-blocker";
import { TransactionsList } from "@/features/transactions/ui/transactions-list";
import { TransactionsSkeleton } from "@/features/transactions/ui/transactions-skeleton";
import { useDialogStack } from "@/hooks/use-dialog-stack";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(orpc.tags.getAll.queryOptions({}));
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.transactions.getAll.queryOptions({
            input: { page: 1, pageSize: 20 },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.transactions.getSummary.queryOptions({
            input: {
               dateFrom: DEFAULT_FILTERS.dateFrom,
               dateTo: DEFAULT_FILTERS.dateTo,
            },
         }),
      );
   },
   component: TransactionsPage,
});

function TransactionsPage() {
   const { openDialogStack, closeDialogStack } = useDialogStack();
   const navigate = useNavigate();
   const { slug, teamSlug } = Route.useParams();
   const { hasBankAccounts } = useTransactionPrerequisites();
   const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);

   const handleCreate = useCallback(() => {
      if (!hasBankAccounts) {
         openDialogStack({
            children: (
               <TransactionPrerequisitesBlocker
                  onAction={() => {
                     closeDialogStack();
                     navigate({
                        to: "/$slug/$teamSlug/bank-accounts",
                        params: { slug, teamSlug },
                     });
                  }}
               />
            ),
         });
         return;
      }
      openDialogStack({
         children: (
            <TransactionDialogStack
               mode="create"
               onSuccess={closeDialogStack}
            />
         ),
      });
   }, [
      hasBankAccounts,
      openDialogStack,
      closeDialogStack,
      navigate,
      slug,
      teamSlug,
   ]);

   useEffect(() => {
      const handler = (e: Event) => {
         const detail = (e as CustomEvent<{ itemId: string }>).detail;
         if (detail.itemId === "transactions") {
            handleCreate();
         }
      };
      window.addEventListener("sidebar:quick-create", handler);
      return () => window.removeEventListener("sidebar:quick-create", handler);
   }, [handleCreate]);

   const panelActions: PanelAction[] = [
      {
         icon: Upload,
         label: "Importar",
         onClick: () =>
            openDialogStack({
               children: (
                  <TransactionImportDialogStack onClose={closeDialogStack} />
               ),
            }),
      },
      {
         icon: Download,
         label: "Exportar",
         onClick: () =>
            openDialogStack({
               children: (
                  <TransactionExportDialogStack
                     dateFrom={filters.dateFrom}
                     dateTo={filters.dateTo}
                     onClose={closeDialogStack}
                  />
               ),
            }),
      },
   ];

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4" />
                  <span className="sr-only sm:not-sr-only">
                     Novo Lançamento
                  </span>
               </Button>
            }
            description="Gerencie suas receitas, despesas e transferências"
            panelActions={panelActions}
            title="Lançamentos"
         />
         <TransactionFilterBar filters={filters} onFiltersChange={setFilters} />
         <Suspense fallback={<TransactionsSkeleton />}>
            <TransactionsList
               filters={filters}
               onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
               onPageSizeChange={(pageSize) =>
                  setFilters((f) => ({ ...f, pageSize, page: 1 }))
               }
            />
         </Suspense>
      </main>
   );
}
