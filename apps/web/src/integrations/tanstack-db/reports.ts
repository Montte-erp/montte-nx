import dayjs from "dayjs";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { createOptimisticAction } from "@tanstack/react-db";
import type { Collection } from "@tanstack/react-db";
import { orpc, type Inputs, type Outputs } from "@/integrations/orpc/client";

export type ReportRow = Outputs["reports"]["list"][number];
export type ReportCreateInput = Inputs["reports"]["create"];
export type ProfitAndLossReportRow = Outputs["reports"]["profitAndLoss"] & {
   id: string;
};
export type CashFlowReportRow = Outputs["reports"]["cashFlow"] & { id: string };
export type CostCentersReportRow =
   Outputs["reports"]["expensesByCostCenter"] & { id: string };
export type AgingReportRow = Outputs["reports"]["aging"] & { id: string };
export type CategoryExpensesReportRow =
   Outputs["reports"]["expensesByCategory"] & { id: string };
export type ReportTransactionRow =
   Outputs["transactions"]["getAll"]["data"][number];
export type TransactionSummaryRow = { id: string; total: number };

export type ReportCollection = Collection<ReportRow, string>;

export function buildReportCollectionRowId(prefix = "__report_") {
   if (typeof crypto !== "undefined") {
      if (typeof crypto.randomUUID === "function") {
         return `${prefix}${crypto.randomUUID()}`;
      }

      if (typeof crypto.getRandomValues === "function") {
         const bytes = new Uint8Array(16);
         crypto.getRandomValues(bytes);
         const hex = Array.from(bytes, (byte) =>
            byte.toString(16).padStart(2, "0"),
         ).join("");
         return `${prefix}${hex}`;
      }
   }

   return `${prefix}${dayjs().valueOf().toString(36)}`;
}

type ReportCollectionOptionsParams = {
   queryClient: QueryClient;
   teamId: string;
};

type ReportIdInput = {
   id: string;
};

type ReportCreateActionInput = {
   row: ReportRow;
   input: ReportCreateInput;
};

type BulkReportRemoveInput = Inputs["reports"]["bulkRemove"];

type ProfitAndLossInput = Inputs["reports"]["profitAndLoss"];
type CashFlowInput = Inputs["reports"]["cashFlow"];
type CostCentersInput = Inputs["reports"]["expensesByCostCenter"];
type AgingInput = Inputs["reports"]["aging"];
type CategoryExpensesInput = Inputs["reports"]["expensesByCategory"];
type TransactionsGetAllInput = Inputs["transactions"]["getAll"];
type TransactionsSummaryInput = Inputs["transactions"]["getSummary"];

type ProfitAndLossCollectionInput = {
   queryClient: QueryClient;
   input: ProfitAndLossInput;
};

type CashFlowCollectionInput = {
   queryClient: QueryClient;
   input: CashFlowInput;
};

type CostCentersCollectionInput = {
   queryClient: QueryClient;
   input: CostCentersInput;
};

type AgingCollectionInput = {
   queryClient: QueryClient;
   input: AgingInput;
};

type CategoryExpensesCollectionInput = {
   queryClient: QueryClient;
   input: CategoryExpensesInput;
};

type ReportTransactionsCollectionInput = {
   queryClient: QueryClient;
   input: TransactionsGetAllInput;
};

type ReportTransactionSummaryCollectionInput = {
   queryClient: QueryClient;
   input: TransactionsSummaryInput;
};

async function safeRefetchReportCollection(collection: ReportCollection) {
   await collection.utils.refetch().catch(() => {});
}

function buildReportOutputId(namespace: string, input: unknown) {
   return `${namespace}:${JSON.stringify(input ?? {})}`;
}

export function buildOptimisticReportRow({
   id,
   input,
   teamId,
}: {
   id: string;
   input: ReportCreateInput;
   teamId: string;
}): ReportRow {
   const now = dayjs().toDate();
   return {
      id,
      teamId,
      name: input.name,
      type: input.type,
      source: "manual",
      config: {
         dateFrom: input.config.dateFrom,
         dateTo: input.config.dateTo,
         status: input.config.status ?? "all",
         dreOnly: input.config.dreOnly ?? true,
         agingType: input.config.agingType ?? "income",
         agingStatus: input.config.agingStatus ?? "open",
         categoryDepth: input.config.categoryDepth ?? "group",
         minAmount: input.config.minAmount ?? 0,
         bankAccountId: input.config.bankAccountId,
         categoryId: input.config.categoryId,
         tagId: input.config.tagId,
      },
      createdAt: now,
      updatedAt: now,
   };
}

export function reportsCollectionOptions({
   queryClient,
   teamId,
}: ReportCollectionOptionsParams) {
   return queryCollectionOptions({
      id: `reports:${teamId}`,
      queryKey: ["reports", teamId],
      queryFn: () => orpc.reports.list.call(),
      queryClient,
      getKey: (report) => report.id,
      syncMode: "on-demand",
      refetchInterval: 5_000,
      meta: {
         notifyOnError: true,
         errorMessage: "Não foi possível sincronizar os relatórios.",
      },
   });
}

export function reportByIdCollectionOptions({
   queryClient,
   teamId,
   id,
}: {
   queryClient: QueryClient;
   teamId: string;
   id: string;
}) {
   return queryCollectionOptions({
      id: `reports-by-id:${teamId}:${id}`,
      queryKey: ["reports", teamId, id],
      queryFn: async () => {
         const report = await orpc.reports.get.call({ id });
         return [report];
      },
      queryClient,
      getKey: (report) => report.id,
      syncMode: "on-demand",
      meta: {
         notifyOnError: true,
         errorMessage: "Não foi possível carregar o relatório.",
      },
   });
}

export function createReportAction(collection: ReportCollection) {
   return createOptimisticAction<ReportCreateActionInput>({
      onMutate: ({ row }) => {
         collection.insert(row);
      },
      mutationFn: async ({ input }) => {
         const created = await orpc.reports.create.call(input);
         await safeRefetchReportCollection(collection);
         return created;
      },
   });
}

export function removeReportAction(collection: ReportCollection) {
   return createOptimisticAction<ReportIdInput>({
      onMutate: ({ id }) => {
         collection.delete(id);
      },
      mutationFn: async ({ id }) => {
         const removed = await orpc.reports.remove.call({ id });
         await safeRefetchReportCollection(collection);
         return removed;
      },
   });
}

export function bulkRemoveReportAction(collection: ReportCollection) {
   return createOptimisticAction<BulkReportRemoveInput>({
      onMutate: ({ ids }) => {
         collection.delete(ids);
      },
      mutationFn: async ({ ids }) => {
         const removed = await orpc.reports.bulkRemove.call({ ids });
         await safeRefetchReportCollection(collection);
         return removed;
      },
   });
}

export function profitAndLossReportCollectionOptions({
   queryClient,
   input,
}: ProfitAndLossCollectionInput) {
   const id = buildReportOutputId("profit-and-loss", input);
   return queryCollectionOptions({
      id,
      queryKey: ["reports", "profit-and-loss", input],
      queryFn: async () => {
         const report = await orpc.reports.profitAndLoss.call(input);
         const row: ProfitAndLossReportRow = { ...report, id };
         return [row];
      },
      queryClient,
      getKey: (report) => report.id,
      syncMode: "on-demand",
      meta: {
         notifyOnError: true,
         errorMessage: "Não foi possível carregar o DRE.",
      },
   });
}

export function cashFlowReportCollectionOptions({
   queryClient,
   input,
}: CashFlowCollectionInput) {
   const id = buildReportOutputId("cash-flow", input);
   return queryCollectionOptions({
      id,
      queryKey: ["reports", "cash-flow", input],
      queryFn: async () => {
         const report = await orpc.reports.cashFlow.call(input);
         const row: CashFlowReportRow = { ...report, id };
         return [row];
      },
      queryClient,
      getKey: (report) => report.id,
      syncMode: "on-demand",
      meta: {
         notifyOnError: true,
         errorMessage: "Não foi possível carregar o fluxo de caixa.",
      },
   });
}

export function costCentersReportCollectionOptions({
   queryClient,
   input,
}: CostCentersCollectionInput) {
   const id = buildReportOutputId("cost-centers", input);
   return queryCollectionOptions({
      id,
      queryKey: ["reports", "cost-centers", input],
      queryFn: async () => {
         const report = await orpc.reports.expensesByCostCenter.call(input);
         const row: CostCentersReportRow = { ...report, id };
         return [row];
      },
      queryClient,
      getKey: (report) => report.id,
      syncMode: "on-demand",
      meta: {
         notifyOnError: true,
         errorMessage:
            "Não foi possível carregar despesas por centro de custo.",
      },
   });
}

export function agingReportCollectionOptions({
   queryClient,
   input,
}: AgingCollectionInput) {
   const id = buildReportOutputId("aging", input);
   return queryCollectionOptions({
      id,
      queryKey: ["reports", "aging", input],
      queryFn: async () => {
         const report = await orpc.reports.aging.call(input);
         const row: AgingReportRow = { ...report, id };
         return [row];
      },
      queryClient,
      getKey: (report) => report.id,
      syncMode: "on-demand",
      meta: {
         notifyOnError: true,
         errorMessage: "Não foi possível carregar o aging.",
      },
   });
}

export function categoryExpensesReportCollectionOptions({
   queryClient,
   input,
}: CategoryExpensesCollectionInput) {
   const id = buildReportOutputId("categories", input);
   return queryCollectionOptions({
      id,
      queryKey: ["reports", "categories", input],
      queryFn: async () => {
         const report = await orpc.reports.expensesByCategory.call(input);
         const row: CategoryExpensesReportRow = { ...report, id };
         return [row];
      },
      queryClient,
      getKey: (report) => report.id,
      syncMode: "on-demand",
      meta: {
         notifyOnError: true,
         errorMessage: "Não foi possível carregar despesas por categoria.",
      },
   });
}

export function reportTransactionsCollectionOptions({
   queryClient,
   input,
}: ReportTransactionsCollectionInput) {
   return queryCollectionOptions({
      id: buildReportOutputId("transactions", {
         ...input,
         reportSnapshot: true,
      }),
      queryKey: ["reports", "transactions", input],
      queryFn: async () => {
         const result = await orpc.transactions.getAll.call(input);
         return result.data;
      },
      queryClient,
      getKey: (row: ReportTransactionRow) => row.id,
      syncMode: "on-demand",
      meta: {
         notifyOnError: true,
         errorMessage: "Não foi possível carregar os lançamentos da snapshot.",
      },
   });
}

export function reportTransactionsSummaryCollectionOptions({
   queryClient,
   input,
}: ReportTransactionSummaryCollectionInput) {
   return queryCollectionOptions({
      id: buildReportOutputId("transactions-summary", input),
      queryKey: ["reports", "transactions-summary", input],
      queryFn: async () => {
         const summary = await orpc.transactions.getSummary.call(input);
         const row: TransactionSummaryRow = {
            id: buildReportOutputId("transactions-summary", input),
            total: summary.totalCount,
         };
         return [row];
      },
      queryClient,
      getKey: (row) => row.id,
      syncMode: "on-demand",
      meta: {
         notifyOnError: true,
         errorMessage: "Não foi possível carregar o total de lançamentos.",
      },
   });
}
