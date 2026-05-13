import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DefaultHeader } from "../-layout/default-header";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { QueryBoundary } from "@/components/query-boundary";
import { TransactionsList } from "./-transactions/transactions-list";
import { buildTransactionColumns } from "./-transactions/transactions-columns";
import { normalizeTransactionSorting } from "./-transactions/transaction-sorting";
import { orpc } from "@/integrations/orpc/client";

const skeletonColumns = buildTransactionColumns();

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
   search: z.string().catch("").default(""),
   view: z
      .enum(["all", "payable", "receivable", "settled", "ignored"])
      .catch("all")
      .default("all"),
   overdueOnly: z.boolean().catch(false).default(false),
   status: z
      .array(z.enum(["pending", "paid"]))
      .catch([])
      .default([]),
   contactId: z.string().catch("").default(""),
   bankId: z.string().catch("").default(""),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
)({
   validateSearch: transactionsSearchSchema,
   loaderDeps: ({
      search: {
         page,
         pageSize,
         sorting,
         view,
         overdueOnly,
         status,
         search,
         contactId,
         bankId,
      },
   }) => ({
      page,
      pageSize,
      sorting,
      view,
      overdueOnly,
      status,
      search,
      contactId,
      bankId,
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
         orpc.transactions.getAll.queryOptions({
            input: {
               page: deps.page,
               pageSize: deps.pageSize,
               sorting: normalizeTransactionSorting(deps.sorting),
               view: deps.view,
               overdueOnly: deps.overdueOnly,
               status: deps.status.length > 0 ? deps.status : undefined,
               search: deps.search || undefined,
               contactId: deps.contactId || undefined,
               bankAccountId: deps.bankId || undefined,
            },
         }),
      );
   },
   pendingMs: 300,
   pendingComponent: () => (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DataTableSkeleton columns={skeletonColumns} />
      </main>
   ),
   head: () => ({
      meta: [{ title: "Lançamentos — Montte" }],
   }),
   component: TransactionsPage,
});

function TransactionsPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Gerencie receitas, despesas e transferências"
            title="Lançamentos"
         />
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<DataTableSkeleton columns={skeletonColumns} />}
               errorTitle="Erro ao carregar lançamentos"
            >
               <TransactionsList />
            </QueryBoundary>
         </div>
      </main>
   );
}
