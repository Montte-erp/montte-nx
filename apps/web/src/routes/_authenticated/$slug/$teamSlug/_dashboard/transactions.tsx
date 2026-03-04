import { Button } from "@packages/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, LayoutGrid, LayoutList, Plus, Upload } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { DefaultHeader } from "@/components/default-header";
import type { PanelAction } from "@/features/context-panel/context-panel-store";
import { useTransactionPrerequisites } from "@/features/transactions/hooks/use-transaction-prerequisites";
import { TransactionExportCredenza } from "@/features/transactions/ui/transaction-export-credenza";
import {
   DEFAULT_FILTERS,
   TransactionFilterBar,
   type TransactionFilters,
} from "@/features/transactions/ui/transaction-filter-bar";
import { TransactionImportCredenza } from "@/features/transactions/ui/transaction-import-credenza";
import { TransactionPrerequisitesBlocker } from "@/features/transactions/ui/transaction-prerequisites-blocker";
import { TransactionsList } from "@/features/transactions/ui/transactions-list";
import { TransactionSheet } from "@/features/transactions/ui/transactions-sheet";
import { TransactionsSkeleton } from "@/features/transactions/ui/transactions-skeleton";
import type { ViewConfig } from "@/features/view-switch/hooks/use-view-switch";
import { useViewSwitch } from "@/features/view-switch/hooks/use-view-switch";
import { useCredenza } from "@/hooks/use-credenza";
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
   },
   component: TransactionsPage,
});

const TRANSACTION_VIEWS: [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

function TransactionsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const navigate = useNavigate();
   const { slug, teamSlug } = Route.useParams();
   const { hasBankAccounts } = useTransactionPrerequisites();
   const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
   const { currentView, setView, views } = useViewSwitch(
      "finance:transactions:view",
      TRANSACTION_VIEWS,
   );

   const handleCreate = useCallback(() => {
      if (!hasBankAccounts) {
         openCredenza({
            children: (
               <TransactionPrerequisitesBlocker
                  onAction={() => {
                     closeCredenza();
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
      openCredenza({
         children: <TransactionSheet mode="create" onSuccess={closeCredenza} />,
      });
   }, [hasBankAccounts, openCredenza, closeCredenza, navigate, slug, teamSlug]);

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
            openCredenza({
               className: "max-w-2xl ",

               children: <TransactionImportCredenza />,
            }),
      },
      {
         icon: Download,
         label: "Exportar",
         onClick: () =>
            openCredenza({
               children: (
                  <TransactionExportCredenza
                     dateFrom={filters.dateFrom}
                     dateTo={filters.dateTo}
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
                  <Plus className="size-4 mr-1" />
                  Nova Transação
               </Button>
            }
            description="Gerencie suas receitas, despesas e transferências"
            panelActions={panelActions}
            title="Transações"
            viewSwitch={{ options: views, currentView, onViewChange: setView }}
         />
         <TransactionFilterBar filters={filters} onFiltersChange={setFilters} />
         <Suspense fallback={<TransactionsSkeleton />}>
            <TransactionsList
               filters={filters}
               onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
               onPageSizeChange={(pageSize) =>
                  setFilters((f) => ({ ...f, pageSize, page: 1 }))
               }
               view={currentView}
            />
         </Suspense>
      </main>
   );
}
