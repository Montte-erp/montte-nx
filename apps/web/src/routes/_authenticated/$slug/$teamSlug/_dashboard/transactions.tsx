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
import { TransactionCredenza } from "@/features/transactions/ui/transaction-credenza";
import { TransactionExportCredenza } from "@/features/transactions/ui/transaction-export-credenza";
import {
   DEFAULT_FILTERS,
   TransactionFilterBar,
   type TransactionFilters,
} from "@/features/transactions/ui/transaction-filter-bar";
import { StatementImportCredenza } from "./-transactions/statement-import-credenza";
import { TransactionPrerequisitesBlocker } from "@/features/transactions/ui/transaction-prerequisites-blocker";
import { TransactionsList } from "@/features/transactions/ui/transactions-list";
import { TransactionsSkeleton } from "@/features/transactions/ui/transactions-skeleton";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

const transactionsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
)({
   validateSearch: transactionsSearchSchema,
   loaderDeps: ({ search: { page, pageSize } }) => ({ page, pageSize }),
   loader: ({ context, deps }) => {
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
            input: { page: deps.page, pageSize: deps.pageSize },
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
   pendingMs: 300,
   pendingComponent: TransactionsSkeleton,
   head: () => ({
      meta: [{ title: "Lançamentos — Montte" }],
   }),
   component: TransactionsPage,
});

function TransactionsPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const navigate = Route.useNavigate();
   const { slug, teamSlug } = Route.useParams();
   const { currentTeam } = Route.useRouteContext();
   const { hasBankAccounts } = useTransactionPrerequisites();
   const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
   const handleFiltersChange = useCallback(
      (nextFilters: TransactionFilters) => {
         setFilters(nextFilters);
         navigate({ search: (prev) => ({ ...prev, page: 1 }), replace: true });
      },
      [navigate],
   );
   const { sorting, columnFilters, page, pageSize } = Route.useSearch();
   const filtersWithPagination = { ...filters, page, pageSize };

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         navigate({
            search: (prev) => ({ ...prev, sorting: next }),
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
               search: (prev) => ({
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
            <TransactionCredenza mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [hasBankAccounts, openCredenza, closeCredenza, navigate, slug, teamSlug]);

   const panelActions: PanelAction[] = [
      {
         icon: Upload,
         label: "Importar",
         onClick: () =>
            openCredenza({
               children: (
                  <StatementImportCredenza
                     teamId={currentTeam.id}
                     onClose={closeCredenza}
                  />
               ),
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
         <TransactionFilterBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
         />
         <Suspense fallback={<TransactionsSkeleton />}>
            <TransactionsList
               columnFilters={columnFilters}
               filters={filtersWithPagination}
               onColumnFiltersChange={handleColumnFiltersChange}
               onPageChange={(newPage) =>
                  navigate({
                     search: (prev) => ({ ...prev, page: newPage }),
                     replace: true,
                  })
               }
               onPageSizeChange={(newPageSize) =>
                  navigate({
                     search: (prev) => ({
                        ...prev,
                        pageSize: newPageSize,
                        page: 1,
                     }),
                     replace: true,
                  })
               }
               onSortingChange={handleSortingChange}
               sorting={sorting}
            />
         </Suspense>
      </main>
   );
}
