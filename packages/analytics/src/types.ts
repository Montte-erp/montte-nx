import { z } from "zod";

// ──────────────────────────────────────────────
// Shared Primitives (keep these — used by date-ranges.ts)
// ──────────────────────────────────────────────

export const relativeDateRangeSchema = z.object({
  type: z.literal("relative"),
  value: z.enum([
    "7d", "14d", "30d", "90d", "180d", "12m",
    "this_month", "last_month", "this_quarter", "this_year",
  ]),
});

export const absoluteDateRangeSchema = z.object({
  type: z.literal("absolute"),
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export const dateRangeSchema = z.discriminatedUnion("type", [
  relativeDateRangeSchema,
  absoluteDateRangeSchema,
]);

// ──────────────────────────────────────────────
// Transaction Filters (shared across all insight types)
// ──────────────────────────────────────────────

export const transactionFiltersSchema = z.object({
  dateRange: dateRangeSchema,
  transactionType: z.array(z.enum(["income", "expense", "transfer"])).optional(),
  bankAccountIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
});

// ──────────────────────────────────────────────
// Measure
// ──────────────────────────────────────────────

export const measureSchema = z.object({
  aggregation: z.enum(["sum", "count", "avg"]),
});

// ──────────────────────────────────────────────
// KPI Config
// ──────────────────────────────────────────────

export const kpiConfigSchema = z.object({
  type: z.literal("kpi"),
  measure: measureSchema,
  filters: transactionFiltersSchema,
  compare: z.boolean().optional().default(false),
});

// ──────────────────────────────────────────────
// Time Series Config
// ──────────────────────────────────────────────

export const timeSeriesConfigSchema = z.object({
  type: z.literal("time_series"),
  measure: measureSchema,
  filters: transactionFiltersSchema,
  interval: z.enum(["day", "week", "month"]).default("month"),
  chartType: z.enum(["line", "bar"]).default("line"),
  compare: z.boolean().optional().default(false),
});

// ──────────────────────────────────────────────
// Breakdown Config
// ──────────────────────────────────────────────

export const breakdownConfigSchema = z.object({
  type: z.literal("breakdown"),
  measure: measureSchema,
  filters: transactionFiltersSchema,
  groupBy: z.enum(["category", "bank_account", "transaction_type", "subcategory"]).default("category"),
  limit: z.number().int().positive().optional().default(10),
});

// ──────────────────────────────────────────────
// Union
// ──────────────────────────────────────────────

export const insightConfigSchema = z.discriminatedUnion("type", [
  kpiConfigSchema,
  timeSeriesConfigSchema,
  breakdownConfigSchema,
]);

// ──────────────────────────────────────────────
// Inferred Types
// ──────────────────────────────────────────────

export type DateRange = z.infer<typeof dateRangeSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type Measure = z.infer<typeof measureSchema>;
export type KpiConfig = z.infer<typeof kpiConfigSchema>;
export type TimeSeriesConfig = z.infer<typeof timeSeriesConfigSchema>;
export type BreakdownConfig = z.infer<typeof breakdownConfigSchema>;
export type InsightConfig = z.infer<typeof insightConfigSchema>;

// ──────────────────────────────────────────────
// Result Types
// ──────────────────────────────────────────────

export interface KpiResult {
  value: number;
  comparison?: {
    value: number;
    percentageChange: number;
  };
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface TimeSeriesResult {
  data: TimeSeriesDataPoint[];
  comparison?: {
    data: TimeSeriesDataPoint[];
  };
}

export interface BreakdownItem {
  label: string;
  value: number;
  color?: string | null;
}

export interface BreakdownResult {
  data: BreakdownItem[];
  total: number;
}
