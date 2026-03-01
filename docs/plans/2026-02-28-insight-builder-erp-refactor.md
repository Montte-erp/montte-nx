# Insight Builder ERP Refactor

**Date:** 2026-02-28
**Status:** Approved

## Context

The insight builder was originally built around web analytics concepts (trends/funnels/retention using event tracking). The app is a Finance + Inventory ERP. This refactor replaces the analytics paradigm with an ERP-native metric builder focused on financial transaction data.

Inventory tables do not exist yet — the design is finance-first but structurally extensible.

## Design

### Insight Types

Three explicit types, each mapped to a specific chart:

| Type | Chart | Question |
|------|-------|----------|
| `kpi` | Number card | "What is my total X right now?" |
| `time_series` | Line or Bar | "How is X changing over time?" |
| `breakdown` | Bar | "Where is X coming from / going to?" |

### Config Schema

```typescript
type Measure = {
  aggregation: "sum" | "count" | "avg"
  // sum/avg operate on amount; count counts transactions
}

type TransactionFilters = {
  dateRange: DateRange
  transactionType?: ("income" | "expense" | "transfer")[]
  bankAccountIds?: string[]
  categoryIds?: string[]
  tagIds?: string[]
}

type KpiConfig = {
  type: "kpi"
  measure: Measure
  filters: TransactionFilters
  compare?: boolean
}

type TimeSeriesConfig = {
  type: "time_series"
  measure: Measure
  filters: TransactionFilters
  interval: "day" | "week" | "month"
  chartType: "line" | "bar"
  compare?: boolean
}

type BreakdownConfig = {
  type: "breakdown"
  measure: Measure
  filters: TransactionFilters
  groupBy: "category" | "bank_account" | "transaction_type" | "subcategory" | "tag"
  limit?: number
}

type InsightConfig = KpiConfig | TimeSeriesConfig | BreakdownConfig
```

The `insights` database table shape is unchanged — only the JSONB `config` content and the `type` enum values change (`kpi` / `time_series` / `breakdown`).

### Result Types

```typescript
type KpiResult = {
  value: number
  comparison?: { value: number; percentageChange: number }
}

type TimeSeriesResult = {
  data: Array<{ date: string; value: number }>
  comparison?: { data: Array<{ date: string; value: number }> }
}

type BreakdownResult = {
  data: Array<{ label: string; value: number; color?: string }>
  total: number
}
```

### UI Components

**Tab bar:** KPI (Hash icon) | Time Series (TrendingUp) | Breakdown (PieChart)

**Type-specific builders (left sidebar):**

- `KpiQueryBuilder` — measure selector + compare toggle
- `TimeSeriesQueryBuilder` — measure selector + interval + chart type toggle + compare toggle
- `BreakdownQueryBuilder` — measure selector + group by selector + limit (Top 5 / Top 10 / All)

**Shared filter bar (all types):**
- Date range picker
- Transaction type multi-select (Income / Expense / Transfer)
- Bank account multi-select
- Category multi-select

**Unchanged:** `InsightHeader`, `InsightStatusLine`, `InsightPreview`

### Analytics Engine

Replace event-based compute modules with transaction-based ones:

```
packages/analytics/src/
├── compute-insight.ts       (dispatcher — same pattern)
├── compute-kpi.ts           (new — replaces trends.ts)
├── compute-time-series.ts   (new — replaces funnels.ts)
├── compute-breakdown.ts     (new — replaces retention.ts)
├── date-ranges.ts           (unchanged)
└── types.ts                 (updated result types)
```

Each module runs a single Drizzle query on `transactions`, filtering by `teamId` + `TransactionFilters`, then aggregating.

### Default Insights

| Name | Type | Measure | Filters | Extra |
|------|------|---------|---------|-------|
| Receita este mês | kpi | sum(amount) | income, this month | compare=true |
| Despesas este mês | kpi | sum(amount) | expense, this month | compare=true |
| Saldo líquido | kpi | sum(amount) | this month | compare=true |
| Receita vs Despesas | time_series | sum(amount) | this month | bar, monthly, income+expense |
| Gastos por categoria | breakdown | sum(amount) | expense, 30d | groupBy=category, top 10 |

### Migration

Existing insights use event-based configs that will break. Migration steps:
1. Delete all existing insights in DB
2. Re-seed with new default insights via seed script

## Files to Change

```
packages/analytics/src/
  types.ts                         update
  compute-insight.ts               update dispatcher
  trends.ts                        delete → replace with compute-kpi.ts
  funnels.ts                       delete → replace with compute-time-series.ts
  retention.ts                     delete → replace with compute-breakdown.ts
  formula.ts                       delete (not needed)
  default-dashboard.ts             update default insight configs

packages/database/src/
  default-insights.ts              update all 5 default insight configs

apps/web/src/features/analytics/
  hooks/use-insight-config.ts      update defaults + type names
  ui/insight-builder.tsx           update tab bar + layout
  ui/insight-tab-bar.tsx           update type labels + icons
  ui/insight-filter-bar.tsx        replace event filters with transaction filters
  ui/insight-preview.tsx           update chart routing
  ui/trends-query-builder.tsx      delete → kpi-query-builder.tsx
  ui/funnels-query-builder.tsx     delete → time-series-query-builder.tsx
  ui/retention-query-builder.tsx   delete → breakdown-query-builder.tsx
  ui/trends-results-table.tsx      delete (no equivalent)
  ui/event-combobox.tsx            delete
  ui/charts/trends-line-chart.tsx  keep, rename to time-series-line-chart.tsx
  ui/charts/trends-bar-chart.tsx   keep, rename to time-series-bar-chart.tsx
  ui/charts/trends-number-card.tsx keep, rename to kpi-number-card.tsx
  ui/charts/funnel-chart.tsx       delete
  ui/charts/retention-grid.tsx     delete
```
