import { Button } from "@packages/ui/components/button";
import { Switch } from "@packages/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import type {
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
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
import { TransactionsSummaryCards } from "./-transactions/transactions-summary-cards";
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
   view: z
      .enum(["all", "payable", "receivable", "settled", "cancelled"])
      .catch("all")
      .default("all"),
   overdueOnly: z.boolean().catch(false).default(false),
   status: z
      .array(z.enum(["pending", "paid", "cancelled"]))
      .catch([])
      .default([]),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
)({
   validateSearch: transactionsSearchSchema,
   loaderDeps: ({ search: { page, pageSize, view, overdueOnly, status } }) => ({
      page,
      pageSize,
      view,
      overdueOnly,
      status,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.tags.getAll.queryOptions({ input: {} }),
      );
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({ input: {} }),
      );
      context.queryClient.prefetchQuery(
         orpc.transactions.getPayableSummary.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.transactions.getAll.queryOptions({
            input: {
               page: deps.page,
               pageSize: deps.pageSize,
               view: deps.view,
               overdueOnly: deps.overdueOnly,
               status: deps.status.length > 0 ? deps.status : undefined,
            },
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
   const { sorting, columnFilters, page, pageSize, view, overdueOnly, status } =
      Route.useSearch();
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

   const handleViewChange = useCallback(
      (nextView: string) => {
         navigate({
            search: (prev) => ({
               ...prev,
               view: nextView as
                  | "all"
                  | "payable"
                  | "receivable"
                  | "settled"
                  | "cancelled",
               page: 1,
            }),
            replace: true,
         });
      },
      [navigate],
   );

   const handleOverdueToggle = useCallback(
      (checked: boolean) => {
         navigate({
            search: (prev) => ({ ...prev, overdueOnly: checked, page: 1 }),
            replace: true,
         });
      },
      [navigate],
   );

   const handleCreate = useCallback(() => {
      if (!hasBankAccounts) {
         openCredenza({
            renderChildren: () => (
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
         renderChildren: () => (
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
               renderChildren: () => (
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
               renderChildren: () => (
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
            description="Gerencie receitas, despesas e transferências"
            panelActions={panelActions}
            title="Lançamentos"
         />
         <QueryBoundary
            fallback={<TransactionsSkeleton />}
            errorTitle="Erro ao carregar resumo"
         >
            <TransactionsSummaryCards />
         </QueryBoundary>
         <Tabs onValueChange={handleViewChange} value={view}>
            <TabsList>
               <TabsTrigger value="all">Todos</TabsTrigger>
               <TabsTrigger value="payable">A Pagar</TabsTrigger>
               <TabsTrigger value="receivable">A Receber</TabsTrigger>
               <TabsTrigger value="settled">Efetivados</TabsTrigger>
               <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
            </TabsList>
         </Tabs>
         <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-2.5">
            <TransactionFilterBar
               filters={filters}
               onFiltersChange={handleFiltersChange}
            />
            <label className="flex items-center gap-2 text-sm font-medium">
               <Switch
                  checked={overdueOnly}
                  id="overdueOnly"
                  onCheckedChange={handleOverdueToggle}
               />
               Somente vencidos
            </label>
         </div>
         <QueryBoundary
            fallback={<TransactionsSkeleton />}
            errorTitle="Erro ao carregar lançamentos"
         >
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
               overdueOnly={overdueOnly}
               sorting={sorting}
               status={status}
               view={view}
            />
         </QueryBoundary>
      </main>
   );
}
