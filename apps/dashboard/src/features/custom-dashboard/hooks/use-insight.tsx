import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { z } from "zod";

// ============================================
// Schemas
// ============================================

export const defaultInsightTypeSchema = z.enum([
   "transactions",
   "bills",
   "budgets",
   "bank_accounts",
]);

export const savedInsightSchema = z.object({
   id: z.string(),
   name: z.string(),
   description: z.string().nullable(),
   config: z.custom<InsightConfig>(),
   createdAt: z.coerce.date(),
   updatedAt: z.coerce.date(),
});

// ============================================
// Types
// ============================================

export type DefaultInsightType = z.infer<typeof defaultInsightTypeSchema>;
export type SavedInsight = z.infer<typeof savedInsightSchema>;

// ============================================
// Constants
// ============================================

export const DEFAULT_INSIGHT_CONFIGS: Record<
   DefaultInsightType,
   InsightConfig
> = {
   transactions: {
      type: "insight",
      dataSource: "transactions",
      aggregation: "sum",
      aggregateField: "amount",
      timeGrouping: "month",
      breakdown: { field: "categoryId", limit: 10 },
      filters: [],
      chartType: "line",
   },
   bills: {
      type: "insight",
      dataSource: "bills",
      aggregation: "sum",
      aggregateField: "amount",
      timeGrouping: "month",
      breakdown: { field: "type", limit: 10 },
      filters: [],
      chartType: "bar",
   },
   budgets: {
      type: "insight",
      dataSource: "budgets",
      aggregation: "sum",
      aggregateField: "amount",
      timeGrouping: "month",
      filters: [],
      chartType: "bar",
   },
   bank_accounts: {
      type: "insight",
      dataSource: "bank_accounts",
      aggregation: "sum",
      aggregateField: "balance",
      breakdown: { field: "name", limit: 10 },
      filters: [],
      chartType: "stat_card",
   },
};

export const DEFAULT_INSIGHT_NAMES: Record<DefaultInsightType, string> = {
   transactions: "Transactions Overview",
   bills: "Bills Summary",
   budgets: "Budget Progress",
   bank_accounts: "Account Balances",
};

export const DEFAULT_INSIGHT_DESCRIPTIONS: Record<DefaultInsightType, string> =
   {
      transactions: "Track your income and expenses over time",
      bills: "Monitor upcoming and paid bills",
      budgets: "View budget allocation and spending",
      bank_accounts: "Current balance across all accounts",
   };
