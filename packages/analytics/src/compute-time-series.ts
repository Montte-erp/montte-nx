import type { DatabaseInstance } from "@packages/database/client";
import { transactions } from "@packages/database/schemas/transactions";
import { AppError, propagateError } from "@packages/utils/errors";
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

  let valueExpr = sql<number>`count(*)::int`;
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
