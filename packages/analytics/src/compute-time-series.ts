import type { DatabaseInstance } from "@core/database/client";
import { transactions } from "@core/database/schemas/transactions";
import { AppError, propagateError } from "@core/logging/errors";
import { and, sql } from "drizzle-orm";
import { buildConditions } from "./compute-kpi";
import {
   resolveDateRange,
   resolveDateRangeWithComparison,
} from "./date-ranges";
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

async function computeSeries(
   db: DatabaseInstance,
   teamId: string,
   config: TimeSeriesConfig,
   start: Date,
   end: Date,
): Promise<TimeSeriesDataPoint[]> {
   const conditions = buildConditions(teamId, config.filters, start, end);
   const truncExpr = sql<string>`date_trunc(${config.interval}, ${transactions.date}::timestamp)::date::text`;

   const rows = await db
      .select({
         date: truncExpr,
         value: aggregationExpr(config.measure.aggregation),
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

   return rows.map((r) => ({
      date: r.date,
      value: Number(r.value),
   }));
}
