# @packages/analytics

KPI, time-series, and breakdown analytics computation engine.

## Exports

| Export                  | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `./types`               | Zod-validated insight config schemas, filter types, result interfaces |
| `./compute-kpi`         | KPI computation with optional comparison periods                      |
| `./compute-time-series` | Time-series aggregation by configurable intervals                     |
| `./compute-breakdown`   | Breakdown by category, account, or type                               |
| `./compute-insight`     | Unified entry point that dispatches to the correct compute function   |
| `./defaults`            | Pre-configured insight definitions                                    |
| `./seed-defaults`       | Seed default insights for new teams                                   |
| `./date-ranges`         | Date range utilities                                                  |

## Usage

```typescript
import { computeInsight } from "@packages/analytics/compute-insight";

const result = await computeInsight(db, {
   type: "kpi",
   measure: "sum",
   filters: { dateRange: "last_30_days", categories: [] },
});
```

## How It Works

Supports three insight types: KPI (single value with optional comparison), time-series (aggregated over intervals), and breakdown (grouped by dimension). Filters transactions by date range and categories, applying sum, count, avg, or net aggregations.
