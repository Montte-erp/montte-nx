# Analytics Package Refactor — Separation of Concerns + Code Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move default insights/dashboard config from `core/database` into `packages/analytics`, clean up all compute code to use Drizzle operators (not raw SQL), and update to the new package pattern with tests.

**Architecture:** `core/database` owns schemas and generic CRUD repositories. `packages/analytics` owns domain logic: default insight definitions, default dashboard construction, and all compute functions. Each compute file is self-contained with its own conditions and aggregations — no shared abstraction layer.

**Tech Stack:** Drizzle ORM, Vitest, oxlint, TypeScript

---

### Task 1: Update analytics package scaffolding to new pattern

**Files:**
- Modify: `packages/analytics/package.json`
- Rename: `packages/analytics/.oxlintrc.json` → `packages/analytics/oxlint.json`
- Create: `packages/analytics/tsconfig.test.json`
- Create: `packages/analytics/vitest.config.ts`

**Step 1: Rename `.oxlintrc.json` to `oxlint.json` with proper schema**

```bash
mv packages/analytics/.oxlintrc.json packages/analytics/oxlint.json
```

Update content to:

```json
{
   "$schema": "../../node_modules/oxlint/configuration_schema.json",
   "extends": ["../../tooling/oxc/packages.json"]
}
```

**Step 2: Create `tsconfig.test.json`**

```json
{
   "extends": "./tsconfig.json",
   "compilerOptions": {
      "types": ["vitest/globals"]
   },
   "include": ["src", "__tests__"]
}
```

**Step 3: Create `vitest.config.ts`**

```typescript
import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
   plugins: [
      viteTsConfigPaths({
         projects: ["./tsconfig.test.json"],
      }),
   ],
   test: {
      include: ["./__tests__/**/*.test.ts"],
   },
});
```

**Step 4: Update `package.json`**

Change `"test"` from `"bun test --pass-with-no-tests"` to `"vitest run"`. Add `format` and `format:check`:

```json
"scripts": {
   "build": "tsc --build",
   "check": "oxlint ./src",
   "format": "oxfmt --write ./src",
   "format:check": "oxfmt --check ./src",
   "test": "vitest run",
   "typecheck": "tsgo"
}
```

**Step 5: Commit**

```bash
git add packages/analytics/
git commit -m "refactor(analytics): update package scaffolding to new pattern"
```

---

### Task 2: Move `DEFAULT_INSIGHTS` from database to analytics

**Files:**
- Create: `packages/analytics/src/defaults.ts`
- Delete: `core/database/src/default-insights.ts`
- Modify: `core/database/package.json` (remove `./default-insights` export)
- Modify: `packages/analytics/package.json` (add `./defaults` export)

**Step 1: Create `packages/analytics/src/defaults.ts`**

Use the typed `InsightConfig` instead of `Record<string, unknown>`:

```typescript
import type { InsightConfig } from "./types";

interface DefaultInsightDef {
   name: string;
   description: string;
   type: "kpi" | "time_series" | "breakdown";
   config: InsightConfig;
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
      description: "Receitas menos despesas no mês atual vs mês anterior",
      type: "kpi",
      config: {
         type: "kpi",
         measure: { aggregation: "net" },
         filters: {
            dateRange: { type: "relative", value: "this_month" },
         },
         compare: true,
      },
      defaultSize: "sm",
   },
   {
      name: "Receita vs Despesas",
      description: "Comparativo mensal de receitas e despesas nos últimos 6 meses",
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

export type { DefaultInsightDef };
```

**Step 2: Add `./defaults` export to `packages/analytics/package.json`**

```json
"./defaults": {
   "types": "./dist/src/defaults.d.ts",
   "default": "./src/defaults.ts"
}
```

**Step 3: Delete `core/database/src/default-insights.ts` and remove its export from `core/database/package.json`**

**Step 4: Commit**

```bash
git add packages/analytics/src/defaults.ts packages/analytics/package.json core/database/package.json
git rm core/database/src/default-insights.ts
git commit -m "refactor(analytics): move DEFAULT_INSIGHTS from database to analytics"
```

---

### Task 3: Move `createDefaultInsights` from dashboard-repository to analytics

**Files:**
- Create: `packages/analytics/src/seed-defaults.ts`
- Modify: `core/database/src/repositories/dashboard-repository.ts` (remove `createDefaultInsights`, `DEFAULT_INSIGHTS` import, `insights` import)
- Modify: `packages/analytics/package.json` (add `./seed-defaults` export)

**Step 1: Create `packages/analytics/src/seed-defaults.ts`**

```typescript
import type { DatabaseInstance } from "@core/database/client";
import { dashboards } from "@core/database/schemas/dashboards";
import { insights } from "@core/database/schemas/insights";
import { AppError, propagateError } from "@core/logging/errors";
import { DEFAULT_INSIGHTS } from "./defaults";

export async function createDefaultInsights(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   userId: string,
): Promise<string[]> {
   try {
      const insightRecords = DEFAULT_INSIGHTS.map((def) => ({
         organizationId,
         teamId,
         createdBy: userId,
         name: def.name,
         description: def.description,
         type: def.type,
         config: def.config as Record<string, unknown>,
         defaultSize: def.defaultSize,
      }));

      const created = await db
         .insert(insights)
         .values(insightRecords)
         .returning({ id: insights.id });

      return created.map((r) => r.id);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create default insights");
   }
}

export async function createDefaultDashboard(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   userId: string,
   name: string,
   insightIds: string[],
) {
   try {
      const tiles = insightIds.map((insightId, index) => ({
         insightId,
         size: DEFAULT_INSIGHTS[index].defaultSize,
         order: index,
      }));

      const [dashboard] = await db
         .insert(dashboards)
         .values({
            organizationId,
            teamId,
            createdBy: userId,
            name,
            description: null,
            isDefault: true,
            tiles,
         })
         .returning();

      return dashboard;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create default dashboard");
   }
}
```

**Step 2: Add `./seed-defaults` export to `packages/analytics/package.json`**

**Step 3: Remove from `dashboard-repository.ts`:**
- Delete the `createDefaultInsights` function (lines 165-192)
- Remove `import { DEFAULT_INSIGHTS } from "@core/database/default-insights"` (line 4)
- Remove `import { insights } from "@core/database/schemas/insights"` (line 14) if unused

**Step 4: Commit**

```bash
git add packages/analytics/ core/database/src/repositories/dashboard-repository.ts
git commit -m "refactor(analytics): move createDefaultInsights and add createDefaultDashboard"
```

---

### Task 4: Update all consumers

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/onboarding.ts`
- Modify: `scripts/seed-default-dashboard.ts`
- Modify: `apps/web/__tests__/integrations/orpc/router/onboarding.test.ts`

**Step 1: Update `onboarding.ts`**

```typescript
// Before
import { DEFAULT_INSIGHTS } from "@core/database/default-insights";
import { createDefaultInsights } from "@core/database/repositories/dashboard-repository";

// After
import { createDefaultDashboard, createDefaultInsights } from "@packages/analytics/seed-defaults";
```

Replace the manual dashboard creation (lines 121-136) with:

```typescript
await createDefaultDashboard(tx, organizationId, teamId, userId, `Dashboard ${workspaceName}`, insightIds);
```

Remove the `DEFAULT_INSIGHTS` import and `dashboards` schema import if now unused.

**Step 2: Update `seed-default-dashboard.ts`**

```typescript
// Before
import { DEFAULT_INSIGHTS } from "@packages/analytics/default-dashboard";

// After
import { DEFAULT_INSIGHTS } from "@packages/analytics/defaults";
```

Also fix the `DATABASE_PACKAGE_DIR` which points to the old `packages/database` path — should be `core/database`:

```typescript
const DATABASE_PACKAGE_DIR = path.join(process.cwd(), "core", "database");
```

**Step 3: Update `onboarding.test.ts`**

Update mock paths to match new import locations.

**Step 4: Run typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/integrations/orpc/router/onboarding.ts scripts/seed-default-dashboard.ts apps/web/__tests__/integrations/orpc/router/onboarding.test.ts
git commit -m "refactor: update consumers to import from analytics package"
```

---

### Task 5: Rewrite compute files — Drizzle operators + clean code

Replace all raw `sql` template conditions with Drizzle operators (`eq`, `gte`, `lte`, `inArray`). Remove all comments, section dividers, JSDoc. Fix the double-parse in `compute-insight.ts`. Keep `buildConditions` inline in `compute-kpi.ts` (it's the only file that defines it — others import it).

**Files:**
- Modify: `packages/analytics/src/compute-kpi.ts`
- Modify: `packages/analytics/src/compute-time-series.ts`
- Modify: `packages/analytics/src/compute-breakdown.ts`
- Modify: `packages/analytics/src/compute-insight.ts`
- Modify: `packages/analytics/src/types.ts`
- Modify: `packages/analytics/src/date-ranges.ts`

**Step 1: Rewrite `compute-kpi.ts`**

Replace raw SQL conditions with Drizzle operators. The `date` column is `date("date")` in Drizzle, so `gte`/`lte` work with ISO date strings. Keep `buildConditions` here since it's imported by the other two files.

```typescript
import type { DatabaseInstance } from "@core/database/client";
import { transactions } from "@core/database/schemas/transactions";
import { AppError, propagateError } from "@core/logging/errors";
import type { SQL } from "drizzle-orm";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { resolveDateRange, resolveDateRangeWithComparison } from "./date-ranges";
import type { KpiConfig, KpiResult, TransactionFilters } from "./types";

export async function executeKpiQuery(
   db: DatabaseInstance,
   teamId: string,
   config: KpiConfig,
): Promise<KpiResult> {
   try {
      const { start, end } = resolveDateRange(config.filters.dateRange);
      const value = await computeValue(db, teamId, config, start, end);

      if (!config.compare) {
         return { value };
      }

      const { previous } = resolveDateRangeWithComparison(config.filters.dateRange);
      const prevValue = await computeValue(db, teamId, config, previous.start, previous.end);
      const percentageChange = prevValue === 0 ? 0 : ((value - prevValue) / prevValue) * 100;

      return { value, comparison: { value: prevValue, percentageChange } };
   } catch (err) {
      propagateError(err);
      throw AppError.internal("Failed to execute KPI query", { cause: err });
   }
}

async function computeValue(
   db: DatabaseInstance,
   teamId: string,
   config: KpiConfig,
   start: Date,
   end: Date,
): Promise<number> {
   const conditions = buildConditions(teamId, config.filters, start, end);
   const valueExpr = aggregationExpr(config.measure.aggregation);

   const result = await db
      .select({ value: valueExpr })
      .from(transactions)
      .where(and(...conditions));

   return Number(result[0]?.value ?? 0);
}

function aggregationExpr(aggregation: "sum" | "count" | "avg" | "net") {
   switch (aggregation) {
      case "count":
         return sql<number>`count(*)::int`;
      case "sum":
         return sql<number>`coalesce(sum(${transactions.amount}), 0)::float`;
      case "avg":
         return sql<number>`coalesce(avg(${transactions.amount}), 0)::float`;
      case "net":
         return sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount}::float when ${transactions.type} = 'expense' then -(${transactions.amount}::float) else 0 end), 0)`;
   }
}

export function buildConditions(
   teamId: string,
   filters: TransactionFilters,
   start: Date,
   end: Date,
): SQL[] {
   const startStr = start.toISOString().split("T")[0]!;
   const endStr = end.toISOString().split("T")[0]!;

   const conditions: SQL[] = [
      eq(transactions.teamId, teamId),
      gte(transactions.date, startStr),
      lte(transactions.date, endStr),
   ];

   if (filters.transactionType?.length) {
      conditions.push(inArray(transactions.type, filters.transactionType));
   }
   if (filters.bankAccountIds?.length) {
      conditions.push(inArray(transactions.bankAccountId, filters.bankAccountIds));
   }
   if (filters.categoryIds?.length) {
      conditions.push(inArray(transactions.categoryId, filters.categoryIds));
   }

   return conditions;
}
```

Key changes:
- `sql\`${transactions.teamId} = ${teamId}\`` → `eq(transactions.teamId, teamId)`
- `sql\`${transactions.date} >= ${startStr}::date\`` → `gte(transactions.date, startStr)`
- `sql\`${transactions.date} <= ${endStr}::date\`` → `lte(transactions.date, endStr)`
- `any[]` → `SQL[]`
- Removed `// biome-ignore` comment
- Removed `// avg` comment
- Aggregation logic extracted to `aggregationExpr` (private, not exported — each file can have its own if needed)
- `computeValue` now takes `config` instead of separate `aggregation` + `filters` params

**Step 2: Rewrite `compute-time-series.ts`**

```typescript
import type { DatabaseInstance } from "@core/database/client";
import { transactions } from "@core/database/schemas/transactions";
import { AppError, propagateError } from "@core/logging/errors";
import { and, sql } from "drizzle-orm";
import { buildConditions } from "./compute-kpi";
import { resolveDateRange, resolveDateRangeWithComparison } from "./date-ranges";
import type { TimeSeriesConfig, TimeSeriesDataPoint, TimeSeriesResult } from "./types";

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

      const { previous } = resolveDateRangeWithComparison(config.filters.dateRange);
      const comparisonData = await computeSeries(db, teamId, config, previous.start, previous.end);

      return { data, comparison: { data: comparisonData } };
   } catch (err) {
      propagateError(err);
      throw AppError.internal("Failed to execute time series query", { cause: err });
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
   const valueExpr = aggregationExpr(config.measure.aggregation);

   const rows = await db
      .select({ date: truncExpr, value: valueExpr })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

   return rows.map((r) => ({ date: r.date, value: Number(r.value) }));
}

function aggregationExpr(aggregation: "sum" | "count" | "avg" | "net") {
   switch (aggregation) {
      case "count":
         return sql<number>`count(*)::int`;
      case "sum":
         return sql<number>`coalesce(sum(${transactions.amount}), 0)::float`;
      case "avg":
         return sql<number>`coalesce(avg(${transactions.amount}), 0)::float`;
      case "net":
         return sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount}::float when ${transactions.type} = 'expense' then -(${transactions.amount}::float) else 0 end), 0)`;
   }
}
```

Key changes:
- Removed redundant `count` check (was `if count ... else if count`)
- Each file has its own `aggregationExpr` — simple, no cross-file coupling for SQL expressions

**Step 3: Rewrite `compute-breakdown.ts`**

```typescript
import type { DatabaseInstance } from "@core/database/client";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { subcategories } from "@core/database/schemas/subcategories";
import { transactions } from "@core/database/schemas/transactions";
import { AppError, propagateError } from "@core/logging/errors";
import { and, desc, eq, sql } from "drizzle-orm";
import { buildConditions } from "./compute-kpi";
import { resolveDateRange } from "./date-ranges";
import type { BreakdownConfig, BreakdownItem, BreakdownResult } from "./types";

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
   income: "Receita",
   expense: "Despesa",
   transfer: "Transferência",
};

export async function executeBreakdownQuery(
   db: DatabaseInstance,
   teamId: string,
   config: BreakdownConfig,
): Promise<BreakdownResult> {
   try {
      const { start, end } = resolveDateRange(config.filters.dateRange);
      const conditions = buildConditions(teamId, config.filters, start, end);
      const limit = config.limit ?? 10;
      const valueExpr = aggregationExpr(config.measure.aggregation);

      const rows = await queryByGrouping(db, conditions, valueExpr, config.groupBy, limit);
      const total = await computeTotal(db, conditions, valueExpr);

      return { data: rows, total };
   } catch (err) {
      propagateError(err);
      throw AppError.internal("Failed to execute breakdown query", { cause: err });
   }
}

function aggregationExpr(aggregation: "sum" | "count" | "avg" | "net") {
   switch (aggregation) {
      case "count":
         return sql<number>`count(*)::int`;
      case "sum":
         return sql<number>`coalesce(sum(${transactions.amount}), 0)::float`;
      case "avg":
         return sql<number>`coalesce(avg(${transactions.amount}), 0)::float`;
      case "net":
         return sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount}::float when ${transactions.type} = 'expense' then -(${transactions.amount}::float) else 0 end), 0)`;
   }
}

async function queryByGrouping(
   db: DatabaseInstance,
   conditions: SQL[],
   valueExpr: ReturnType<typeof aggregationExpr>,
   groupBy: BreakdownConfig["groupBy"],
   limit: number,
): Promise<BreakdownItem[]> {
   switch (groupBy) {
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
         return results.map((r) => ({ label: r.label, value: Number(r.value), color: r.color }));
      }

      case "bank_account": {
         const results = await db
            .select({
               label: sql<string>`coalesce(${bankAccounts.name}, 'Sem conta')`,
               value: valueExpr,
            })
            .from(transactions)
            .leftJoin(bankAccounts, eq(transactions.bankAccountId, bankAccounts.id))
            .where(and(...conditions))
            .groupBy(bankAccounts.id, bankAccounts.name)
            .orderBy(desc(valueExpr))
            .limit(limit);
         return results.map((r) => ({ label: r.label, value: Number(r.value) }));
      }

      case "transaction_type": {
         const results = await db
            .select({ label: transactions.type, value: valueExpr })
            .from(transactions)
            .where(and(...conditions))
            .groupBy(transactions.type)
            .orderBy(desc(valueExpr))
            .limit(limit);
         return results.map((r) => ({
            label: TRANSACTION_TYPE_LABELS[r.label ?? ""] ?? r.label ?? "Desconhecido",
            value: Number(r.value),
         }));
      }

      case "subcategory": {
         const results = await db
            .select({
               label: sql<string>`coalesce(${subcategories.name}, 'Sem subcategoria')`,
               value: valueExpr,
            })
            .from(transactions)
            .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
            .where(and(...conditions))
            .groupBy(subcategories.id, subcategories.name)
            .orderBy(desc(valueExpr))
            .limit(limit);
         return results.map((r) => ({ label: r.label, value: Number(r.value) }));
      }
   }
}

async function computeTotal(
   db: DatabaseInstance,
   conditions: SQL[],
   valueExpr: ReturnType<typeof aggregationExpr>,
): Promise<number> {
   const result = await db
      .select({ value: valueExpr })
      .from(transactions)
      .where(and(...conditions));
   return Number(result[0]?.value ?? 0);
}
```

Key changes:
- `conditions` param typed as `SQL[]` instead of `ReturnType<typeof buildConditions>`
- Aggregation logic self-contained per file
- `TRANSACTION_TYPE_LABELS` moved to module level (was inline in switch case)

**Step 4: Rewrite `compute-insight.ts`**

Fix the double-parse (discriminated union already narrows the type), remove dead `default` branch, remove comments:

```typescript
import type { DatabaseInstance } from "@core/database/client";
import type { Insight } from "@core/database/schemas/insights";
import { AppError, propagateError } from "@core/logging/errors";
import { executeBreakdownQuery } from "./compute-breakdown";
import { executeKpiQuery } from "./compute-kpi";
import { executeTimeSeriesQuery } from "./compute-time-series";
import { insightConfigSchema } from "./types";

export async function computeInsightData(
   db: DatabaseInstance,
   insight: Insight,
): Promise<Record<string, unknown>> {
   try {
      const config = insightConfigSchema.parse(insight.config);

      switch (config.type) {
         case "kpi":
            return await executeKpiQuery(db, insight.teamId, config) as unknown as Record<string, unknown>;
         case "time_series":
            return await executeTimeSeriesQuery(db, insight.teamId, config) as unknown as Record<string, unknown>;
         case "breakdown":
            return await executeBreakdownQuery(db, insight.teamId, config) as unknown as Record<string, unknown>;
      }
   } catch (err) {
      propagateError(err);
      throw AppError.internal(`Failed to compute insight data: ${err}`, { cause: err });
   }
}
```

**Step 5: Clean `types.ts`**

Remove all `// ──────────` section dividers. Keep schemas and types only.

**Step 6: Clean `date-ranges.ts`**

Remove all section dividers (`// ──────────`) and JSDoc comments.

**Step 7: Run typecheck**

```bash
bun run typecheck
```

**Step 8: Commit**

```bash
git add packages/analytics/src/
git commit -m "refactor(analytics): use Drizzle operators, remove comments, fix double-parse"
```

---

### Task 6: Write tests for `date-ranges.ts`

**Files:**
- Create: `packages/analytics/__tests__/date-ranges.test.ts`

**Step 1: Write tests**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDateRange, resolveDateRangeWithComparison } from "@packages/analytics/date-ranges";

describe("resolveDateRange", () => {
   afterEach(() => {
      vi.useRealTimers();
   });

   it("resolves absolute date range", () => {
      const result = resolveDateRange({
         type: "absolute",
         start: "2026-01-01T00:00:00.000Z",
         end: "2026-01-31T23:59:59.000Z",
      });
      expect(result.start).toEqual(new Date("2026-01-01T00:00:00.000Z"));
      expect(result.end).toEqual(new Date("2026-01-31T23:59:59.000Z"));
   });

   it("resolves 7d relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));

      const result = resolveDateRange({ type: "relative", value: "7d" });
      expect(result.start).toEqual(new Date("2026-03-04T00:00:00.000Z"));
   });

   it("resolves 14d relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));

      const result = resolveDateRange({ type: "relative", value: "14d" });
      expect(result.start).toEqual(new Date("2026-02-25T00:00:00.000Z"));
   });

   it("resolves 30d relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));

      const result = resolveDateRange({ type: "relative", value: "30d" });
      expect(result.start).toEqual(new Date("2026-02-09T00:00:00.000Z"));
   });

   it("resolves 90d relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));

      const result = resolveDateRange({ type: "relative", value: "90d" });
      expect(result.start).toEqual(new Date("2025-12-11T00:00:00.000Z"));
   });

   it("resolves 180d relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));

      const result = resolveDateRange({ type: "relative", value: "180d" });
      expect(result.start).toEqual(new Date("2025-09-12T00:00:00.000Z"));
   });

   it("resolves 12m relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));

      const result = resolveDateRange({ type: "relative", value: "12m" });
      expect(result.start).toEqual(new Date("2025-03-11T00:00:00.000Z"));
   });

   it("resolves this_month relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

      const result = resolveDateRange({ type: "relative", value: "this_month" });
      expect(result.start).toEqual(new Date("2026-03-01T00:00:00.000Z"));
   });

   it("resolves last_month relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

      const result = resolveDateRange({ type: "relative", value: "last_month" });
      expect(result.start).toEqual(new Date("2026-02-01T00:00:00.000Z"));
      expect(result.end).toEqual(new Date("2026-03-01T00:00:00.000Z"));
   });

   it("resolves this_quarter relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));

      const result = resolveDateRange({ type: "relative", value: "this_quarter" });
      expect(result.start).toEqual(new Date("2026-04-01T00:00:00.000Z"));
   });

   it("resolves this_year relative range", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

      const result = resolveDateRange({ type: "relative", value: "this_year" });
      expect(result.start).toEqual(new Date("2026-01-01T00:00:00.000Z"));
   });
});

describe("resolveDateRangeWithComparison", () => {
   afterEach(() => {
      vi.useRealTimers();
   });

   it("previous period has equal length to main period", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));

      const result = resolveDateRangeWithComparison({ type: "relative", value: "30d" });
      const mainDuration = result.end.getTime() - result.start.getTime();
      const prevDuration = result.previous.end.getTime() - result.previous.start.getTime();
      expect(prevDuration).toBe(mainDuration);
   });

   it("previous period ends where main period starts for absolute ranges", () => {
      const result = resolveDateRangeWithComparison({
         type: "absolute",
         start: "2026-01-01T00:00:00.000Z",
         end: "2026-01-31T00:00:00.000Z",
      });
      expect(result.previous.end).toEqual(new Date("2026-01-01T00:00:00.000Z"));
   });

   it("computes correct previous start for absolute range", () => {
      const result = resolveDateRangeWithComparison({
         type: "absolute",
         start: "2026-01-01T00:00:00.000Z",
         end: "2026-01-31T00:00:00.000Z",
      });
      expect(result.previous.start).toEqual(new Date("2025-12-02T00:00:00.000Z"));
   });
});
```

**Step 2: Run tests**

```bash
cd packages/analytics && npx vitest run __tests__/date-ranges.test.ts
```

**Step 3: Commit**

```bash
git add packages/analytics/__tests__/date-ranges.test.ts
git commit -m "test(analytics): add date-ranges tests"
```

---

### Task 7: Write tests for `defaults.ts`

**Files:**
- Create: `packages/analytics/__tests__/defaults.test.ts`

**Step 1: Write tests**

```typescript
import { describe, expect, it } from "vitest";
import { DEFAULT_INSIGHTS } from "@packages/analytics/defaults";
import { insightConfigSchema } from "@packages/analytics/types";

describe("DEFAULT_INSIGHTS", () => {
   it("contains 5 default insights", () => {
      expect(DEFAULT_INSIGHTS).toHaveLength(5);
   });

   it("every config is valid per insightConfigSchema", () => {
      for (const insight of DEFAULT_INSIGHTS) {
         const result = insightConfigSchema.safeParse(insight.config);
         expect(result.success, `Invalid config for "${insight.name}"`).toBe(true);
      }
   });

   it("type matches config.type for each insight", () => {
      for (const insight of DEFAULT_INSIGHTS) {
         expect(insight.type).toBe(insight.config.type);
      }
   });

   it("every defaultSize is valid", () => {
      const validSizes = new Set(["sm", "md", "lg", "full"]);
      for (const insight of DEFAULT_INSIGHTS) {
         expect(validSizes.has(insight.defaultSize)).toBe(true);
      }
   });
});
```

**Step 2: Run tests**

```bash
cd packages/analytics && npx vitest run __tests__/defaults.test.ts
```

**Step 3: Commit**

```bash
git add packages/analytics/__tests__/defaults.test.ts
git commit -m "test(analytics): add defaults validation tests"
```

---

### Task 8: Verify everything

**Step 1: Run full typecheck**

```bash
bun run typecheck
```

**Step 2: Run full test suite**

```bash
bun run test
```

**Step 3: Run linter**

```bash
bun run check
```

**Step 4: Fix any issues found**

**Step 5: Final commit if any cleanup needed**

```bash
git commit -m "chore(analytics): final cleanup"
```

---

## Summary of Changes

| Area | Before | After |
|------|--------|-------|
| Default insights | `core/database/src/default-insights.ts` | `packages/analytics/src/defaults.ts` |
| Seeding logic | `createDefaultInsights` in dashboard-repository | `packages/analytics/src/seed-defaults.ts` |
| Dashboard creation | Inline in `onboarding.ts` | `createDefaultDashboard` in `seed-defaults.ts` |
| SQL conditions | Raw `sql` templates (`sql\`field = val\``) | Drizzle operators (`eq`, `gte`, `lte`, `inArray`) |
| Type safety | `any[]` conditions, `Record<string, unknown>` config | `SQL[]` conditions, typed `InsightConfig` |
| Code hygiene | Comments, section dividers, JSDoc, double-parse | Clean, self-documenting code |
| Tests | None | `date-ranges.test.ts`, `defaults.test.ts` |
| Tooling | `.oxlintrc.json` + `bun test` | `oxlint.json` + `vitest run` + `tsconfig.test.json` |
