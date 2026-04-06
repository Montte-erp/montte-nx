import { Button } from "@packages/ui/components/button";
import type {
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Upload } from "lucide-react";
import { Suspense, useCallback, useState } from "react";
import { z } from "zod";
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
import { StatementImportDialogStack } from "./-transactions/statement-import-dialog-stack";
import { TransactionPrerequisitesBlocker } from "@/features/transactions/ui/transaction-prerequisites-blocker";
import { TransactionsList } from "@/features/transactions/ui/transactions-list";
import { TransactionsSkeleton } from "@/features/transactions/ui/transactions-skeleton";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

const transactionsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .optional()
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .optional()
      .default([]),
});

type TransactionsSearch = z.infer<typeof transactionsSearchSchema>;

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
)({
   validateSearch: transactionsSearchSchema,
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
   const { openCredenza, closeCredenza } = useCredenza();
   const navigate = Route.useNavigate();
   const { slug, teamSlug } = Route.useParams();
   const { hasBankAccounts } = useTransactionPrerequisites();
   const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
   const { sorting, columnFilters } = Route.useSearch();

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         navigate({
            search: (prev: TransactionsSearch) => ({ ...prev, sorting: next }),
            replace: true,
         });
      },
      [sorting, navigate],
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      useCallback(
         (updater) => {
            const next =
               typeof updater === "function" ? updater(columnFilters) : updater;
            navigate({
               search: (prev: TransactionsSearch) => ({
                  ...prev,
                  columnFilters: next,
               }),
               replace: true,
            });
         },
         [columnFilters, navigate],
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
         children: (
            <TransactionDialogStack mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [hasBankAccounts, openCredenza, closeCredenza, navigate, slug, teamSlug]);

   const panelActions: PanelAction[] = [
      {
         icon: Upload,
         label: "Importar",
         onClick: () =>
            openCredenza({
               children: <StatementImportDialogStack onClose={closeCredenza} />,
            }),
      },
      {
         icon: Download,
         label: "Exportar",
         onClick: () =>
            openCredenza({
               children: (
                  <TransactionExportDialogStack
                     dateFrom={filters.dateFrom}
                     dateTo={filters.dateTo}
                     onClose={closeCredenza}
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
               columnFilters={columnFilters}
               filters={filters}
               onColumnFiltersChange={handleColumnFiltersChange}
               onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
               onPageSizeChange={(pageSize) =>
                  setFilters((f) => ({ ...f, pageSize, page: 1 }))
               }
               onSortingChange={handleSortingChange}
               sorting={sorting}
            />
         </Suspense>
      </main>
   );
}
