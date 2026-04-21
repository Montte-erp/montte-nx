import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import { TransactionsList } from "@/features/transactions/ui/transactions-list";
import { TransactionsSkeleton } from "@/features/transactions/ui/transactions-skeleton";
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
   search: z.string().catch("").default(""),
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
   loaderDeps: ({
      search: { page, pageSize, view, overdueOnly, status, search },
   }) => ({
      page,
      pageSize,
      view,
      overdueOnly,
      status,
      search,
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
               view: deps.view,
               overdueOnly: deps.overdueOnly,
               status: deps.status.length > 0 ? deps.status : undefined,
               search: deps.search || undefined,
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
   const navigate = Route.useNavigate();

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

   const { view } = Route.useSearch();

   return (
      <main className="flex h-full flex-col gap-4">
         <DefaultHeader
            description="Gerencie receitas, despesas e transferências"
            title="Lançamentos"
         />
         <Tabs onValueChange={handleViewChange} value={view}>
            <TabsList>
               <TabsTrigger value="all">Todos</TabsTrigger>
               <TabsTrigger value="payable">A Pagar</TabsTrigger>
               <TabsTrigger value="receivable">A Receber</TabsTrigger>
               <TabsTrigger value="settled">Efetivados</TabsTrigger>
               <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
            </TabsList>
         </Tabs>
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<TransactionsSkeleton />}
               errorTitle="Erro ao carregar lançamentos"
            >
               <TransactionsList />
            </QueryBoundary>
         </div>
      </main>
   );
}
