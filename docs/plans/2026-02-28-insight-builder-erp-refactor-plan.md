# Insight Builder ERP Refactor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the web-analytics insight builder (trends/funnels/retention) with an ERP-native metric builder (KPI/Time Series/Breakdown) backed by the `transactions` table.

**Architecture:** Three explicit insight types (kpi, time_series, breakdown) each backed by a dedicated Drizzle query module in `packages/analytics/src/`. The UI builder has a left-sidebar query config and a right-side preview, same layout as the current funnels/retention. The `insights` DB table is unchanged — only the JSONB `config` content and the `type` enum values change.

**Tech Stack:** Drizzle ORM, Zod, oRPC, React, Recharts (via existing chart components), TanStack Query

---

## Batch 1 — Analytics Types (must run first, everything else depends on this)

### Task 1: Replace analytics types schema

**Files:**

- Modify: `packages/analytics/src/types.ts`

**What to do:** Replace the entire file. Keep `dateRangeSchema`, `relativeDateRangeSchema`, `absoluteDateRangeSchema` (reused). Delete everything else. Add new ERP schemas.

**New content for `packages/analytics/src/types.ts`:**

```typescript
import { z } from "zod";

// ──────────────────────────────────────────────
// Shared Primitives (keep these — used by date-ranges.ts)
// ──────────────────────────────────────────────

export const relativeDateRangeSchema = z.object({
   type: z.literal("relative"),
   value: z.enum([
      "7d",
      "14d",
      "30d",
      "90d",
      "180d",
      "12m",
      "this_month",
      "last_month",
      "this_quarter",
      "this_year",
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
   transactionType: z
      .array(z.enum(["income", "expense", "transfer"]))
      .optional(),
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
   groupBy: z
      .enum(["category", "bank_account", "transaction_type", "subcategory"])
      .default("category"),
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
```

**Step 1: Run typecheck to see what breaks**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -60
```

Expected: errors in files that import old types (trends.ts, funnels.ts, retention.ts, formula.ts, analytics router, UI components). That's fine — we'll fix them in subsequent tasks.

**Step 2: Commit**

```bash
git add packages/analytics/src/types.ts
git commit -m "feat(analytics): replace event-based types with ERP metric types (kpi/time_series/breakdown)"
```

---

## Batch 2 — Compute Modules (run in parallel after Task 1)

### Task 2A: Create compute-kpi.ts

**Files:**

- Create: `packages/analytics/src/compute-kpi.ts`

**Content:**

```typescript
import type { DatabaseInstance } from "@packages/database/client";
import { transactions } from "@packages/database/schemas/transactions";
import { AppError, propagateError } from "@packages/utils/errors";
import { and, avg, count, gte, inArray, lte, sql, sum } from "drizzle-orm";
import {
   resolveDateRange,
   resolveDateRangeWithComparison,
} from "./date-ranges";
import type { KpiConfig, KpiResult, TransactionFilters } from "./types";

export async function executeKpiQuery(
   db: DatabaseInstance,
   teamId: string,
   config: KpiConfig,
): Promise<KpiResult> {
   try {
      const { start, end } = resolveDateRange(config.filters.dateRange);
      const value = await computeValue(
         db,
         teamId,
         config.measure.aggregation,
         config.filters,
         start,
         end,
      );

      if (!config.compare) {
         return { value };
      }

      const { previous } = resolveDateRangeWithComparison(
         config.filters.dateRange,
      );
      const prevValue = await computeValue(
         db,
         teamId,
         config.measure.aggregation,
         config.filters,
         previous.start,
         previous.end,
      );
      const percentageChange =
         prevValue === 0 ? 0 : ((value - prevValue) / prevValue) * 100;

      return { value, comparison: { value: prevValue, percentageChange } };
   } catch (err) {
      propagateError(err);
      throw AppError.internal("Failed to execute KPI query", { cause: err });
   }
}

async function computeValue(
   db: DatabaseInstance,
   teamId: string,
   aggregation: "sum" | "count" | "avg",
   filters: TransactionFilters,
   start: Date,
   end: Date,
): Promise<number> {
   const conditions = buildConditions(teamId, filters, start, end);

   if (aggregation === "count") {
      const result = await db
         .select({ value: sql<number>`count(*)::int` })
         .from(transactions)
         .where(and(...conditions));
      return result[0]?.value ?? 0;
   }

   if (aggregation === "sum") {
      const result = await db
         .select({
            value: sql<number>`coalesce(sum(${transactions.amount}), 0)::float`,
         })
         .from(transactions)
         .where(and(...conditions));
      return Number(result[0]?.value ?? 0);
   }

   // avg
   const result = await db
      .select({
         value: sql<number>`coalesce(avg(${transactions.amount}), 0)::float`,
      })
      .from(transactions)
      .where(and(...conditions));
   return Number(result[0]?.value ?? 0);
}

export function buildConditions(
   teamId: string,
   filters: TransactionFilters,
   start: Date,
   end: Date,
) {
   const startStr = start.toISOString().split("T")[0];
   const endStr = end.toISOString().split("T")[0];

   const conditions = [
      sql`${transactions.teamId} = ${teamId}`,
      sql`${transactions.date} >= ${startStr}`,
      sql`${transactions.date} <= ${endStr}`,
   ];

   if (filters.transactionType?.length) {
      conditions.push(inArray(transactions.type, filters.transactionType));
   }
   if (filters.bankAccountIds?.length) {
      conditions.push(
         inArray(transactions.bankAccountId, filters.bankAccountIds),
      );
   }
   if (filters.categoryIds?.length) {
      conditions.push(
         sql`${transactions.categoryId} = ANY(${filters.categoryIds})`,
      );
   }

   return conditions;
}
```

**Step 1: Check imports compile**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "compute-kpi" | head -20
```

**Step 2: Commit**

```bash
git add packages/analytics/src/compute-kpi.ts
git commit -m "feat(analytics): add KPI compute module for transaction aggregation"
```

---

### Task 2B: Create compute-time-series.ts

**Files:**

- Create: `packages/analytics/src/compute-time-series.ts`

**Content:**

```typescript
import type { DatabaseInstance } from "@packages/database/client";
import { transactions } from "@packages/database/schemas/transactions";
import { AppError, propagateError } from "@packages/utils/errors";
import { and, sql } from "drizzle-orm";
import {
   resolveDateRange,
   resolveDateRangeWithComparison,
} from "./date-ranges";
import { buildConditions } from "./compute-kpi";
import type {
   TimeSeriesConfig,
   TimeSeriesDataPoint,
   TimeSeriesResult,
} from "./types";

export async function executeTimeSeriesQuery(
   db: DatabaseInstance,
   teamId: string,
   config: TimeSeriesConfig,
): Promise<TimeSeriesResult> {
   try {
      const { start, end } = resolveDateRange(config.filters.dateRange);
      const data = await computeSeries(db, teamId, config, start, end);

      if (!config.compare) {
         return { data };
      }

      const { previous } = resolveDateRangeWithComparison(
         config.filters.dateRange,
      );
      const comparisonData = await computeSeries(
         db,
         teamId,
         config,
         previous.start,
         previous.end,
      );

      return { data, comparison: { data: comparisonData } };
   } catch (err) {
      propagateError(err);
      throw AppError.internal("Failed to execute time series query", {
         cause: err,
      });
   }
}

async function computeSeries(
   db: DatabaseInstance,
   teamId: string,
   config: TimeSeriesConfig,
   start: Date,
   end: Date,
): Promise<TimeSeriesDataPoint[]> {
   const conditions = buildConditions(teamId, config.filters, start, end);

   const truncExpr = sql<string>`date_trunc(${config.interval}, ${transactions.date}::timestamp)::date::text`;

   let valueExpr: ReturnType<typeof sql>;
   if (config.measure.aggregation === "count") {
      valueExpr = sql<number>`count(*)::int`;
   } else if (config.measure.aggregation === "sum") {
      valueExpr = sql<number>`coalesce(sum(${transactions.amount}), 0)::float`;
   } else {
      valueExpr = sql<number>`coalesce(avg(${transactions.amount}), 0)::float`;
   }

   const rows = await db
      .select({
         date: truncExpr,
         value: valueExpr,
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(truncExpr)
      .orderBy(truncExpr);

   return rows.map((r) => ({
      date: r.date,
      value: Number(r.value),
   }));
}
```

**Step 1: Commit**

```bash
git add packages/analytics/src/compute-time-series.ts
git commit -m "feat(analytics): add time series compute module"
```

---

### Task 2C: Create compute-breakdown.ts

**Files:**

- Create: `packages/analytics/src/compute-breakdown.ts`

**Content:**

```typescript
import type { DatabaseInstance } from "@packages/database/client";
import { bankAccounts } from "@packages/database/schemas/bank-accounts";
import { categories } from "@packages/database/schemas/categories";
import { subcategories } from "@packages/database/schemas/subcategories";
import { transactions } from "@packages/database/schemas/transactions";
import { AppError, propagateError } from "@packages/utils/errors";
import { and, desc, eq, sql } from "drizzle-orm";
import { resolveDateRange } from "./date-ranges";
import { buildConditions } from "./compute-kpi";
import type { BreakdownConfig, BreakdownItem, BreakdownResult } from "./types";

export async function executeBreakdownQuery(
   db: DatabaseInstance,
   teamId: string,
   config: BreakdownConfig,
): Promise<BreakdownResult> {
   try {
      const { start, end } = resolveDateRange(config.filters.dateRange);
      const conditions = buildConditions(teamId, config.filters, start, end);
      const limit = config.limit ?? 10;

      let valueExpr: ReturnType<typeof sql>;
      if (config.measure.aggregation === "count") {
         valueExpr = sql<number>`count(*)::int`;
      } else if (config.measure.aggregation === "sum") {
         valueExpr = sql<number>`coalesce(sum(${transactions.amount}), 0)::float`;
      } else {
         valueExpr = sql<number>`coalesce(avg(${transactions.amount}), 0)::float`;
      }

      let rows: BreakdownItem[] = [];

      switch (config.groupBy) {
         case "category": {
            const results = await db
               .select({
                  label: sql<string>`coalesce(${categories.name}, 'Sem categoria')`,
                  color: categories.color,
                  value: valueExpr,
               })
               .from(transactions)
               .leftJoin(categories, eq(transactions.categoryId, categories.id))
               .where(and(...conditions))
               .groupBy(categories.id, categories.name, categories.color)
               .orderBy(desc(valueExpr))
               .limit(limit);
            rows = results.map((r) => ({
               label: r.label,
               value: Number(r.value),
               color: r.color,
            }));
            break;
         }

         case "bank_account": {
            const results = await db
               .select({
                  label: sql<string>`coalesce(${bankAccounts.name}, 'Sem conta')`,
                  value: valueExpr,
               })
               .from(transactions)
               .leftJoin(
                  bankAccounts,
                  eq(transactions.bankAccountId, bankAccounts.id),
               )
               .where(and(...conditions))
               .groupBy(bankAccounts.id, bankAccounts.name)
               .orderBy(desc(valueExpr))
               .limit(limit);
            rows = results.map((r) => ({
               label: r.label,
               value: Number(r.value),
            }));
            break;
         }

         case "transaction_type": {
            const results = await db
               .select({
                  label: transactions.type,
                  value: valueExpr,
               })
               .from(transactions)
               .where(and(...conditions))
               .groupBy(transactions.type)
               .orderBy(desc(valueExpr));
            const typeLabels: Record<string, string> = {
               income: "Receita",
               expense: "Despesa",
               transfer: "Transferência",
            };
            rows = results.map((r) => ({
               label: typeLabels[r.label] ?? r.label,
               value: Number(r.value),
            }));
            break;
         }

         case "subcategory": {
            const results = await db
               .select({
                  label: sql<string>`coalesce(${subcategories.name}, 'Sem subcategoria')`,
                  value: valueExpr,
               })
               .from(transactions)
               .leftJoin(
                  subcategories,
                  eq(transactions.subcategoryId, subcategories.id),
               )
               .where(and(...conditions))
               .groupBy(subcategories.id, subcategories.name)
               .orderBy(desc(valueExpr))
               .limit(limit);
            rows = results.map((r) => ({
               label: r.label,
               value: Number(r.value),
            }));
            break;
         }
      }

      const total = rows.reduce((sum, item) => sum + item.value, 0);
      return { data: rows, total };
   } catch (err) {
      propagateError(err);
      throw AppError.internal("Failed to execute breakdown query", {
         cause: err,
      });
   }
}
```

**Important:** Check that `subcategories` schema export path exists. Look in `packages/database/package.json` for the exports. The import path should be `@packages/database/schemas/subcategories`. If it's not exported, add it.

**Step 1: Commit**

```bash
git add packages/analytics/src/compute-breakdown.ts
git commit -m "feat(analytics): add breakdown compute module"
```

---

## Batch 3 — Wire up backend (sequential, after Batch 2)

### Task 3: Update compute-insight dispatcher + package exports + analytics router

**Files:**

- Modify: `packages/analytics/src/compute-insight.ts`
- Modify: `packages/analytics/package.json`
- Modify: `apps/web/src/integrations/orpc/router/analytics.ts`

**Step 1: Replace compute-insight.ts**

New content for `packages/analytics/src/compute-insight.ts`:

```typescript
import type { DatabaseInstance } from "@packages/database/client";
import type { Insight } from "@packages/database/schemas/insights";
import { AppError, propagateError } from "@packages/utils/errors";
import { executeBreakdownQuery } from "./compute-breakdown";
import { executeKpiQuery } from "./compute-kpi";
import { executeTimeSeriesQuery } from "./compute-time-series";
import {
   breakdownConfigSchema,
   insightConfigSchema,
   kpiConfigSchema,
   timeSeriesConfigSchema,
} from "./types";

export async function computeInsightData(
   db: DatabaseInstance,
   insight: Insight,
): Promise<Record<string, unknown>> {
   try {
      const config = insightConfigSchema.parse(insight.config);

      switch (config.type) {
         case "kpi": {
            const kpiConfig = kpiConfigSchema.parse(config);
            const result = await executeKpiQuery(db, insight.teamId, kpiConfig);
            return result as unknown as Record<string, unknown>;
         }
         case "time_series": {
            const tsConfig = timeSeriesConfigSchema.parse(config);
            const result = await executeTimeSeriesQuery(
               db,
               insight.teamId,
               tsConfig,
            );
            return result as unknown as Record<string, unknown>;
         }
         case "breakdown": {
            const bdConfig = breakdownConfigSchema.parse(config);
            const result = await executeBreakdownQuery(
               db,
               insight.teamId,
               bdConfig,
            );
            return result as unknown as Record<string, unknown>;
         }
         default: {
            throw AppError.validation(
               `Unknown insight type: ${(config as { type: string }).type}`,
            );
         }
      }
   } catch (err) {
      propagateError(err);
      throw AppError.internal(`Failed to compute insight data: ${err}`, {
         cause: err,
      });
   }
}
```

Note: `computeInsightData` now takes `insight.teamId` instead of `insight.organizationId`. Verify the `Insight` type has a `teamId` field (it does per the schema).

**Step 2: Update package.json exports**

In `packages/analytics/package.json`, replace the `exports` section:

```json
"exports": {
  "./types": {
    "default": "./src/types.ts",
    "types": "./dist/src/types.d.ts"
  },
  "./compute-kpi": {
    "default": "./src/compute-kpi.ts",
    "types": "./dist/src/compute-kpi.d.ts"
  },
  "./compute-time-series": {
    "default": "./src/compute-time-series.ts",
    "types": "./dist/src/compute-time-series.d.ts"
  },
  "./compute-breakdown": {
    "default": "./src/compute-breakdown.ts",
    "types": "./dist/src/compute-breakdown.d.ts"
  },
  "./compute-insight": {
    "default": "./src/compute-insight.ts",
    "types": "./dist/src/compute-insight.d.ts"
  },
  "./date-ranges": {
    "default": "./src/date-ranges.ts",
    "types": "./dist/src/date-ranges.d.ts"
  }
}
```

(Remove `./trends`, `./funnels`, `./retention`, `./formula`, `./default-dashboard` entries.)

**Step 3: Update analytics router**

Replace `apps/web/src/integrations/orpc/router/analytics.ts` query procedure:

```typescript
import { ORPCError } from "@orpc/server";
import { executeBreakdownQuery } from "@packages/analytics/compute-breakdown";
import { executeKpiQuery } from "@packages/analytics/compute-kpi";
import { executeTimeSeriesQuery } from "@packages/analytics/compute-time-series";
import { insightConfigSchema } from "@packages/analytics/types";
import { getDefaultDashboard as fetchDefaultDashboard } from "@packages/database/repositories/dashboard-repository";
import { getInsightsByIds } from "@packages/database/repositories/insight-repository";
import { z } from "zod";
import { protectedProcedure } from "../server";

export const query = protectedProcedure
   .input(z.object({ config: insightConfigSchema }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      try {
         switch (input.config.type) {
            case "kpi":
               return await executeKpiQuery(db, teamId, input.config);
            case "time_series":
               return await executeTimeSeriesQuery(db, teamId, input.config);
            case "breakdown":
               return await executeBreakdownQuery(db, teamId, input.config);
         }
      } catch (error) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to execute analytics query",
            cause: error,
         });
      }
   });

// Keep getDefaultDashboard and getDashboardInsights procedures unchanged
```

Note: Check `context.teamId` is available on `protectedProcedure` — it should be based on the router pattern in CLAUDE.md which shows `context: { db, posthog?, organizationId, userId, session, auth, headers, request, stripeClient? }`. If `teamId` is not in context, check how other routers that need teamId get it (may come from route params instead of context). Look at `apps/web/src/integrations/orpc/router/transactions.ts` for reference.

**Step 4: Run typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -E "(compute-insight|analytics\.ts)" | head -30
```

**Step 5: Commit**

```bash
git add packages/analytics/src/compute-insight.ts packages/analytics/package.json apps/web/src/integrations/orpc/router/analytics.ts
git commit -m "feat(analytics): wire up new compute modules in dispatcher and router"
```

---

### Task 4: Update insights router type enum

**Files:**

- Modify: `apps/web/src/integrations/orpc/router/insights.ts`

**What to do:** Find any hardcoded `z.enum(["trends", "funnels", "retention"])` in the insights router and replace with `z.enum(["kpi", "time_series", "breakdown"])`. The `InsightConfig` union validation is already handled by `insightConfigSchema` from types, so just fix any explicit type enums.

**Step 1: Search for old type values**

```bash
grep -n "trends\|funnels\|retention" apps/web/src/integrations/orpc/router/insights.ts
```

**Step 2:** Replace all occurrences of the old enum. The `config` field validation uses `insightConfigSchema` which is already updated. For explicit `type` fields, change to `z.enum(["kpi", "time_series", "breakdown"])`.

**Step 3: Commit**

```bash
git add apps/web/src/integrations/orpc/router/insights.ts
git commit -m "feat(insights): update router type enum to new ERP values"
```

---

## Batch 4 — UI Components (can run in parallel after Task 1)

### Task 5: Update useInsightConfig hook

**Files:**

- Modify: `apps/web/src/features/analytics/hooks/use-insight-config.ts`

**New content:**

```typescript
import type {
   BreakdownConfig,
   InsightConfig,
   KpiConfig,
   TimeSeriesConfig,
} from "@packages/analytics/types";
import { useDebounce } from "@uidotdev/usehooks";
import { useCallback, useEffect, useState } from "react";

export type InsightType = "kpi" | "time_series" | "breakdown";

const DEFAULT_KPI_CONFIG: KpiConfig = {
   type: "kpi",
   measure: { aggregation: "sum" },
   filters: {
      dateRange: { type: "relative", value: "this_month" },
      transactionType: ["income"],
   },
   compare: true,
};

const DEFAULT_TIME_SERIES_CONFIG: TimeSeriesConfig = {
   type: "time_series",
   measure: { aggregation: "sum" },
   filters: {
      dateRange: { type: "relative", value: "30d" },
   },
   interval: "month",
   chartType: "line",
   compare: false,
};

const DEFAULT_BREAKDOWN_CONFIG: BreakdownConfig = {
   type: "breakdown",
   measure: { aggregation: "sum" },
   filters: {
      dateRange: { type: "relative", value: "30d" },
      transactionType: ["expense"],
   },
   groupBy: "category",
   limit: 10,
};

export function useInsightConfig(initialType: InsightType = "kpi") {
   const [type, setType] = useState<InsightType>(initialType);
   const [config, setConfig] = useState<InsightConfig>(DEFAULT_KPI_CONFIG);
   const [pendingUpdates, setPendingUpdates] = useState<Partial<InsightConfig>>(
      {},
   );
   const debouncedUpdates = useDebounce(pendingUpdates, 500);

   useEffect(() => {
      if (Object.keys(debouncedUpdates).length > 0) {
         setConfig((c) => ({ ...c, ...debouncedUpdates }) as InsightConfig);
         setPendingUpdates({});
      }
   }, [debouncedUpdates]);

   const handleTypeChange = useCallback((newType: InsightType) => {
      setType(newType);
      switch (newType) {
         case "kpi":
            setConfig(DEFAULT_KPI_CONFIG);
            break;
         case "time_series":
            setConfig(DEFAULT_TIME_SERIES_CONFIG);
            break;
         case "breakdown":
            setConfig(DEFAULT_BREAKDOWN_CONFIG);
            break;
      }
   }, []);

   const updateConfig = useCallback((updates: Partial<InsightConfig>) => {
      setPendingUpdates((prev) => ({ ...prev, ...updates }));
   }, []);

   const updateConfigImmediate = useCallback(
      (updates: Partial<InsightConfig>) => {
         setConfig((prev) => ({ ...prev, ...updates }) as InsightConfig);
      },
      [],
   );

   return {
      type,
      config,
      setType: handleTypeChange,
      updateConfig,
      updateConfigImmediate,
   };
}
```

**Step 1: Commit**

```bash
git add apps/web/src/features/analytics/hooks/use-insight-config.ts
git commit -m "feat(insights): update useInsightConfig hook for ERP insight types"
```

---

### Task 6: Create KpiQueryBuilder

**Files:**

- Create: `apps/web/src/features/analytics/ui/kpi-query-builder.tsx`

```typescript
import type { KpiConfig } from "@packages/analytics/types";
import { Label } from "@packages/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@packages/ui/components/select";
import { Switch } from "@packages/ui/components/switch";

interface KpiQueryBuilderProps {
  config: KpiConfig;
  onUpdate: (updates: Partial<KpiConfig>) => void;
}

const AGGREGATION_OPTIONS = [
  { value: "sum", label: "Soma dos valores" },
  { value: "count", label: "Contagem de transações" },
  { value: "avg", label: "Média dos valores" },
] as const;

export function KpiQueryBuilder({ config, onUpdate }: KpiQueryBuilderProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          Métrica
        </Label>
        <Select
          onValueChange={(value) =>
            onUpdate({ measure: { aggregation: value as KpiConfig["measure"]["aggregation"] } })
          }
          value={config.measure.aggregation}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm">Comparar com período anterior</Label>
        <Switch
          checked={config.compare ?? false}
          onCheckedChange={(checked) => onUpdate({ compare: checked })}
        />
      </div>
    </div>
  );
}
```

**Step 1: Commit**

```bash
git add apps/web/src/features/analytics/ui/kpi-query-builder.tsx
git commit -m "feat(insights): add KpiQueryBuilder component"
```

---

### Task 7: Create TimeSeriesQueryBuilder

**Files:**

- Create: `apps/web/src/features/analytics/ui/time-series-query-builder.tsx`

```typescript
import type { TimeSeriesConfig } from "@packages/analytics/types";
import { Label } from "@packages/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@packages/ui/components/select";
import { Switch } from "@packages/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@packages/ui/components/toggle-group";
import { BarChart3, LineChart } from "lucide-react";

interface TimeSeriesQueryBuilderProps {
  config: TimeSeriesConfig;
  onUpdate: (updates: Partial<TimeSeriesConfig>) => void;
}

const AGGREGATION_OPTIONS = [
  { value: "sum", label: "Soma dos valores" },
  { value: "count", label: "Contagem de transações" },
  { value: "avg", label: "Média dos valores" },
] as const;

const INTERVAL_OPTIONS = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
] as const;

export function TimeSeriesQueryBuilder({ config, onUpdate }: TimeSeriesQueryBuilderProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          Métrica
        </Label>
        <Select
          onValueChange={(value) =>
            onUpdate({ measure: { aggregation: value as TimeSeriesConfig["measure"]["aggregation"] } })
          }
          value={config.measure.aggregation}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          Intervalo
        </Label>
        <Select
          onValueChange={(value) =>
            onUpdate({ interval: value as TimeSeriesConfig["interval"] })
          }
          value={config.interval}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          Tipo de gráfico
        </Label>
        <ToggleGroup
          className="justify-start"
          onValueChange={(value) => {
            if (value) onUpdate({ chartType: value as "line" | "bar" });
          }}
          type="single"
          value={config.chartType}
        >
          <ToggleGroupItem value="line">
            <LineChart className="size-4 mr-1.5" />
            Linha
          </ToggleGroupItem>
          <ToggleGroupItem value="bar">
            <BarChart3 className="size-4 mr-1.5" />
            Barras
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm">Comparar com período anterior</Label>
        <Switch
          checked={config.compare ?? false}
          onCheckedChange={(checked) => onUpdate({ compare: checked })}
        />
      </div>
    </div>
  );
}
```

**Step 1: Commit**

```bash
git add apps/web/src/features/analytics/ui/time-series-query-builder.tsx
git commit -m "feat(insights): add TimeSeriesQueryBuilder component"
```

---

### Task 8: Create BreakdownQueryBuilder

**Files:**

- Create: `apps/web/src/features/analytics/ui/breakdown-query-builder.tsx`

```typescript
import type { BreakdownConfig } from "@packages/analytics/types";
import { Label } from "@packages/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@packages/ui/components/select";

interface BreakdownQueryBuilderProps {
  config: BreakdownConfig;
  onUpdate: (updates: Partial<BreakdownConfig>) => void;
}

const AGGREGATION_OPTIONS = [
  { value: "sum", label: "Soma dos valores" },
  { value: "count", label: "Contagem de transações" },
  { value: "avg", label: "Média dos valores" },
] as const;

const GROUP_BY_OPTIONS = [
  { value: "category", label: "Categoria" },
  { value: "bank_account", label: "Conta bancária" },
  { value: "transaction_type", label: "Tipo (Receita/Despesa)" },
  { value: "subcategory", label: "Subcategoria" },
] as const;

const LIMIT_OPTIONS = [
  { value: "5", label: "Top 5" },
  { value: "10", label: "Top 10" },
  { value: "20", label: "Top 20" },
] as const;

export function BreakdownQueryBuilder({ config, onUpdate }: BreakdownQueryBuilderProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          Métrica
        </Label>
        <Select
          onValueChange={(value) =>
            onUpdate({ measure: { aggregation: value as BreakdownConfig["measure"]["aggregation"] } })
          }
          value={config.measure.aggregation}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          Agrupar por
        </Label>
        <Select
          onValueChange={(value) =>
            onUpdate({ groupBy: value as BreakdownConfig["groupBy"] })
          }
          value={config.groupBy}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_BY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          Limite
        </Label>
        <Select
          onValueChange={(value) => onUpdate({ limit: Number(value) })}
          value={String(config.limit ?? 10)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

**Step 1: Commit**

```bash
git add apps/web/src/features/analytics/ui/breakdown-query-builder.tsx
git commit -m "feat(insights): add BreakdownQueryBuilder component"
```

---

### Task 9: Update InsightFilterBar for ERP transactions

**Files:**

- Modify: `apps/web/src/features/analytics/ui/insight-filter-bar.tsx`

**What to do:** Replace the entire component. Remove event analytics filters (interval for trends, chart type dropdown, compare). Add transaction type multi-select. Date range stays the same. The new filter bar accepts a unified `filters` prop and an `onFiltersChange` callback.

```typescript
import type { TransactionFilters } from "@packages/analytics/types";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@packages/ui/components/popover";
import { cn } from "@packages/ui/lib/utils";
import { Calendar, ChevronDown } from "lucide-react";

interface InsightFilterBarProps {
  filters: TransactionFilters;
  onFiltersChange: (updates: Partial<TransactionFilters>) => void;
}

const DATE_RANGE_PRESETS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "14d", label: "Últimos 14 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "180d", label: "Últimos 180 dias" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "this_quarter", label: "Este trimestre" },
  { value: "this_year", label: "Este ano" },
];

const TRANSACTION_TYPES = [
  { value: "income" as const, label: "Receita" },
  { value: "expense" as const, label: "Despesa" },
  { value: "transfer" as const, label: "Transferência" },
];

function getDateRangeLabel(filters: TransactionFilters): string {
  const dr = filters.dateRange;
  if (dr.type === "absolute") return "Período personalizado";
  const preset = DATE_RANGE_PRESETS.find((p) => p.value === dr.value);
  return preset?.label ?? dr.value;
}

export function InsightFilterBar({ filters, onFiltersChange }: InsightFilterBarProps) {
  const selectedTypes = filters.transactionType ?? [];

  const toggleType = (type: "income" | "expense" | "transfer") => {
    const current = filters.transactionType ?? [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFiltersChange({ transactionType: next.length > 0 ? next : undefined });
  };

  return (
    <div className="flex items-center gap-2 border-b py-2">
      {/* Date Range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button className="h-7 text-xs" size="sm" variant="outline">
            <Calendar className="mr-1.5 size-3.5" />
            {getDateRangeLabel(filters)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          <div className="space-y-1">
            {DATE_RANGE_PRESETS.map((preset) => (
              <Button
                className={cn(
                  "w-full justify-start text-xs",
                  filters.dateRange.type === "relative" &&
                    filters.dateRange.value === preset.value &&
                    "bg-accent",
                )}
                key={preset.value}
                onClick={() =>
                  onFiltersChange({
                    dateRange: { type: "relative", value: preset.value as TransactionFilters["dateRange"] extends { value: infer V } ? V : never },
                  })
                }
                size="sm"
                variant="ghost"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Transaction Type Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button className="h-7 text-xs gap-1.5" size="sm" variant="outline">
            {selectedTypes.length === 0
              ? "Todos os tipos"
              : selectedTypes.length === 1
                ? TRANSACTION_TYPES.find((t) => t.value === selectedTypes[0])?.label
                : `${selectedTypes.length} tipos`}
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-44 p-2">
          <div className="space-y-1">
            {TRANSACTION_TYPES.map((type) => (
              <Button
                className={cn(
                  "w-full justify-start text-xs",
                  selectedTypes.includes(type.value) && "bg-accent",
                )}
                key={type.value}
                onClick={() => toggleType(type.value)}
                size="sm"
                variant="ghost"
              >
                {type.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

Note: The `dateRange.value` type cast may need adjusting. Use the actual Zod inferred type for the value enum. If you get a TS error, cast with `as any` temporarily and add a comment `// TODO: fix type`.

**Step 1: Commit**

```bash
git add apps/web/src/features/analytics/ui/insight-filter-bar.tsx
git commit -m "feat(insights): update InsightFilterBar for ERP transaction filters"
```

---

## Batch 5 — Preview + Builder (sequential, after Batch 4)

### Task 10: Rebuild InsightPreview

**Files:**

- Modify: `apps/web/src/features/analytics/ui/insight-preview.tsx`

**What to do:** Replace the full file. Keep `InsightLoadingState` and `InsightErrorState` as-is. Replace `TrendsPreview`, `FunnelsPreview`, `RetentionPreview` with `KpiPreview`, `TimeSeriesPreview`, `BreakdownPreview`. Reuse existing chart components (`TrendsLineChart`, `TrendsBarChart`, `TrendsNumberCard`) since they work with the data we produce.

```typescript
import type {
  BreakdownResult,
  InsightConfig,
  KpiResult,
  TimeSeriesResult,
  TimeSeriesConfig,
} from "@packages/analytics/types";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { useMemo } from "react";
import { orpc } from "@/integrations/orpc/client";
import { TrendsBarChart } from "../charts/trends-bar-chart";
import { TrendsLineChart } from "../charts/trends-line-chart";
import { TrendsNumberCard } from "../charts/trends-number-card";

interface InsightPreviewProps {
  config: InsightConfig;
}

export function InsightLoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

export function InsightErrorState({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
      <AlertCircle className="size-5 text-destructive/60" />
      <p className="text-xs text-center">{error.message}</p>
    </div>
  );
}

function KpiPreview({ data }: { data: KpiResult }) {
  const trend = data.comparison
    ? {
        value: Math.abs(data.comparison.percentageChange),
        direction: (data.comparison.percentageChange >= 0 ? "up" : "down") as "up" | "down",
        comparison: "vs período anterior",
      }
    : undefined;

  return <TrendsNumberCard label="Total" trend={trend} value={data.value} />;
}

function TimeSeriesPreview({ config, data }: { config: TimeSeriesConfig; data: TimeSeriesResult }) {
  const series = [{ key: "value", label: "Valor", color: "var(--chart-1)" }];

  const chartData = useMemo(
    () => data.data.map((point) => ({ date: point.date, value: point.value })),
    [data.data],
  );

  const comparisonData = useMemo(
    () => data.comparison?.data.map((point) => ({ date: point.date, value: point.value })),
    [data.comparison],
  );

  const xAxisFormatter = (value: string) =>
    new Date(value).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Sem dados para o período selecionado
      </div>
    );
  }

  if (config.chartType === "bar") {
    return (
      <TrendsBarChart
        comparisonData={comparisonData}
        data={chartData}
        series={series}
        xAxisFormatter={xAxisFormatter}
        xAxisKey="date"
      />
    );
  }

  return (
    <TrendsLineChart
      comparisonData={comparisonData}
      data={chartData}
      series={series}
      xAxisFormatter={xAxisFormatter}
      xAxisKey="date"
    />
  );
}

function BreakdownPreview({ data }: { data: BreakdownResult }) {
  const series = [{ key: "value", label: "Valor", color: "var(--chart-1)" }];

  const chartData = useMemo(
    () => data.data.map((item) => ({ label: item.label, value: item.value })),
    [data.data],
  );

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Sem dados para o período selecionado
      </div>
    );
  }

  return (
    <TrendsBarChart
      data={chartData}
      series={series}
      xAxisFormatter={(label) => label}
      xAxisKey="label"
    />
  );
}

export function InsightPreview({ config }: InsightPreviewProps) {
  const { data } = useSuspenseQuery(
    orpc.analytics.query.queryOptions({ input: { config } }),
  );

  return (
    <div className="h-full">
      <div className="space-y-3">
        {config.type === "kpi" && <KpiPreview data={data as KpiResult} />}
        {config.type === "time_series" && (
          <TimeSeriesPreview config={config} data={data as TimeSeriesResult} />
        )}
        {config.type === "breakdown" && <BreakdownPreview data={data as BreakdownResult} />}
      </div>
    </div>
  );
}
```

**Step 1: Commit**

```bash
git add apps/web/src/features/analytics/ui/insight-preview.tsx
git commit -m "feat(insights): rebuild InsightPreview for KPI/TimeSeries/Breakdown"
```

---

### Task 11: Rebuild InsightBuilder

**Files:**

- Modify: `apps/web/src/features/analytics/ui/insight-builder.tsx`

**What to do:** Replace the three-type layout (trends vertical, funnels sidebar, retention sidebar) with new type layout. KPI and Breakdown use sidebar layout. TimeSeries uses vertical layout. Update tab bar labels and the filter bar calls to use the new unified `filters` prop.

```typescript
import type {
  BreakdownConfig,
  InsightConfig,
  KpiConfig,
  TimeSeriesConfig,
  TransactionFilters,
} from "@packages/analytics/types";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import { cn } from "@packages/ui/lib/utils";
import { BarChart3, Hash, TrendingUp } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { InsightType } from "@/features/analytics/hooks/use-insight-config";
import { BreakdownQueryBuilder } from "./breakdown-query-builder";
import { InsightFilterBar } from "./insight-filter-bar";
import { InsightHeader } from "./insight-header";
import {
  InsightErrorState,
  InsightLoadingState,
  InsightPreview,
} from "./insight-preview";
import { InsightStatusLine } from "./insight-status-line";
import { KpiQueryBuilder } from "./kpi-query-builder";
import { TimeSeriesQueryBuilder } from "./time-series-query-builder";

const INSIGHT_TABS: { value: InsightType; label: string; icon: React.ElementType }[] = [
  { value: "kpi", label: "KPI", icon: Hash },
  { value: "time_series", label: "Série Temporal", icon: TrendingUp },
  { value: "breakdown", label: "Distribuição", icon: BarChart3 },
];

interface InsightBuilderProps {
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  type: InsightType;
  config: InsightConfig;
  onTypeChange: (type: InsightType) => void;
  onConfigUpdate: (updates: Partial<InsightConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
  lastComputedAt?: Date | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

function getFilters(config: InsightConfig): TransactionFilters {
  return config.filters;
}

export function InsightBuilder({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  type,
  config,
  onTypeChange,
  onConfigUpdate,
  onSave,
  isSaving,
  onDuplicate,
  onDelete,
  lastComputedAt,
  onRefresh,
  isRefreshing = false,
}: InsightBuilderProps) {
  const handleFiltersChange = (updates: Partial<TransactionFilters>) => {
    onConfigUpdate({ filters: { ...getFilters(config), ...updates } } as Partial<InsightConfig>);
  };

  const previewPanel = (
    <Card className="flex-1 min-w-0">
      <CardContent className="p-0">
        <div className="px-4">
          <InsightFilterBar
            filters={getFilters(config)}
            onFiltersChange={handleFiltersChange}
          />
        </div>
        <div className="px-4">
          <InsightStatusLine
            isRefreshing={isRefreshing}
            lastComputedAt={lastComputedAt}
            onRefresh={onRefresh}
          />
        </div>
        <div className="min-h-[400px] p-4">
          <ErrorBoundary
            fallbackRender={({ error }) => <InsightErrorState error={error as Error} />}
          >
            <Suspense fallback={<InsightLoadingState />}>
              <InsightPreview config={config} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <main className="flex flex-col gap-0">
      <InsightHeader
        description={description}
        isSaving={isSaving}
        name={name}
        onDelete={onDelete}
        onDescriptionChange={onDescriptionChange}
        onDuplicate={onDuplicate}
        onNameChange={onNameChange}
        onSave={onSave}
      />

      {/* Tab bar */}
      <div className="flex items-center border-t border-b py-1">
        {INSIGHT_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              className={cn(
                "px-4 py-2 h-auto rounded-none border-b-2 text-sm font-medium gap-1.5",
                type === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50",
              )}
              key={tab.value}
              onClick={() => onTypeChange(tab.value)}
              variant="ghost"
            >
              <Icon className="size-3.5" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 pt-4">
        {/* KPI — sidebar layout */}
        {type === "kpi" && (
          <div className="flex gap-4">
            <div className="w-[320px] shrink-0">
              <Card className="sticky top-4">
                <CardContent className="p-6">
                  <KpiQueryBuilder
                    config={config as KpiConfig}
                    onUpdate={onConfigUpdate}
                  />
                </CardContent>
              </Card>
            </div>
            {previewPanel}
          </div>
        )}

        {/* TIME SERIES — vertical flow */}
        {type === "time_series" && (
          <>
            <Card>
              <CardContent className="p-6">
                <TimeSeriesQueryBuilder
                  config={config as TimeSeriesConfig}
                  onUpdate={onConfigUpdate}
                />
              </CardContent>
            </Card>
            {previewPanel}
          </>
        )}

        {/* BREAKDOWN — sidebar layout */}
        {type === "breakdown" && (
          <div className="flex gap-4">
            <div className="w-[320px] shrink-0">
              <Card className="sticky top-4">
                <CardContent className="p-6">
                  <BreakdownQueryBuilder
                    config={config as BreakdownConfig}
                    onUpdate={onConfigUpdate}
                  />
                </CardContent>
              </Card>
            </div>
            {previewPanel}
          </div>
        )}
      </div>
    </main>
  );
}
```

**Step 1: Run typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "insight-builder" | head -20
```

**Step 2: Commit**

```bash
git add apps/web/src/features/analytics/ui/insight-builder.tsx
git commit -m "feat(insights): rebuild InsightBuilder with KPI/TimeSeries/Breakdown tabs"
```

---

### Task 12: Update default insights

**Files:**

- Modify: `packages/database/src/default-insights.ts`

**New content:**

```typescript
interface DefaultInsightDef {
   name: string;
   description: string;
   type: "kpi" | "time_series" | "breakdown";
   config: Record<string, unknown>;
   defaultSize: "sm" | "md" | "lg" | "full";
}

export const DEFAULT_INSIGHTS: DefaultInsightDef[] = [
   {
      name: "Receita este mês",
      description: "Total de receitas no mês atual vs mês anterior",
      type: "kpi",
      config: {
         type: "kpi",
         measure: { aggregation: "sum" },
         filters: {
            dateRange: { type: "relative", value: "this_month" },
            transactionType: ["income"],
         },
         compare: true,
      },
      defaultSize: "sm",
   },
   {
      name: "Despesas este mês",
      description: "Total de despesas no mês atual vs mês anterior",
      type: "kpi",
      config: {
         type: "kpi",
         measure: { aggregation: "sum" },
         filters: {
            dateRange: { type: "relative", value: "this_month" },
            transactionType: ["expense"],
         },
         compare: true,
      },
      defaultSize: "sm",
   },
   {
      name: "Saldo líquido",
      description: "Total de transações no mês atual",
      type: "kpi",
      config: {
         type: "kpi",
         measure: { aggregation: "count" },
         filters: {
            dateRange: { type: "relative", value: "this_month" },
         },
         compare: true,
      },
      defaultSize: "sm",
   },
   {
      name: "Receita vs Despesas",
      description:
         "Comparativo mensal de receitas e despesas nos últimos 6 meses",
      type: "time_series",
      config: {
         type: "time_series",
         measure: { aggregation: "sum" },
         filters: {
            dateRange: { type: "relative", value: "180d" },
         },
         interval: "month",
         chartType: "bar",
         compare: false,
      },
      defaultSize: "lg",
   },
   {
      name: "Gastos por categoria",
      description: "Distribuição de despesas por categoria nos últimos 30 dias",
      type: "breakdown",
      config: {
         type: "breakdown",
         measure: { aggregation: "sum" },
         filters: {
            dateRange: { type: "relative", value: "30d" },
            transactionType: ["expense"],
         },
         groupBy: "category",
         limit: 10,
      },
      defaultSize: "lg",
   },
];
```

**Step 1: Commit**

```bash
git add packages/database/src/default-insights.ts
git commit -m "feat(database): update default insights with ERP finance metrics"
```

---

## Batch 6 — Cleanup + Type checks

### Task 13: Final typecheck + fix remaining errors

**Step 1: Run full typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -100
```

**Step 2: Fix any remaining import errors** — likely from:

- Files that still import from `@packages/analytics/trends`, `@packages/analytics/funnels`, `@packages/analytics/retention` (old exports removed)
- UI pages (`new.tsx`, `$insightId.tsx`) that pass `type` as old enum values
- Any component that still references `InsightType` from the old hook

**Step 3: Check the route pages** — open these files and verify they work:

- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/new.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/$insightId.tsx`

Both pages use `useInsightConfig()` and pass the result to `InsightBuilder`. After the hook update, the initial type will be `"kpi"` instead of `"trends"`. Verify the `type` prop passed to `InsightBuilder` and `onTypeChange` both use `InsightType` from the updated hook.

**Step 4: Final typecheck must pass**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck
```

Expected: zero errors related to insights/analytics.

**Step 5: Commit**

```bash
git add -p
git commit -m "fix(insights): resolve remaining type errors from ERP refactor"
```

---

### Task 14: Data migration note

**The old insights in the DB use `type: "trends" | "funnels" | "retention"` and old config shapes. These will fail Zod parsing.**

Run this SQL to clear old insights before testing:

```sql
DELETE FROM insights;
```

Or use Drizzle Studio: `bun run db:studio`

After clearing, new default insights are seeded during onboarding. If you need to re-seed defaults for an existing team, run:

```bash
bun run scripts/seed-default-dashboard.ts run --env local
```

Check that script handles the new insight types correctly — if it uses the old `DEFAULT_INSIGHTS` array (now updated), it should work automatically.

---

## Completion Checklist

- [ ] `bun run typecheck` passes with zero errors
- [ ] `bun run check` (Biome) passes
- [ ] Navigate to `/analytics/insights/new` — tab bar shows KPI, Série Temporal, Distribuição
- [ ] Create a KPI insight with Sum + income + this_month — preview shows a number card
- [ ] Create a Time Series insight — preview shows a line chart
- [ ] Create a Breakdown insight grouped by category — preview shows a bar chart
- [ ] Save an insight — navigates to edit page
- [ ] Edit page loads with correct config pre-populated
