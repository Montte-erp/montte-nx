import type { DatabaseInstance } from "@core/database/client";
import { transactions } from "@core/database/schemas/transactions";
import { AppError, propagateError } from "@core/logging/errors";
import { type SQL, and, eq, gte, inArray, lte, sql } from "drizzle-orm";
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

async function computeValue(
   db: DatabaseInstance,
   teamId: string,
   aggregation: "sum" | "count" | "avg" | "net",
   filters: TransactionFilters,
   start: Date,
   end: Date,
): Promise<number> {
   const conditions = buildConditions(teamId, filters, start, end);
   const result = await db
      .select({ value: aggregationExpr(aggregation) })
      .from(transactions)
      .where(and(...conditions));
   return Number(result[0]?.value ?? 0);
}

export function buildConditions(
   teamId: string,
   filters: TransactionFilters,
   start: Date,
   end: Date,
): SQL[] {
   const startStr = start.toISOString().split("T")[0];
   const endStr = end.toISOString().split("T")[0];

   const conditions: SQL[] = [
      eq(transactions.teamId, teamId),
      gte(transactions.date, startStr),
      lte(transactions.date, endStr),
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
      conditions.push(inArray(transactions.categoryId, filters.categoryIds));
   }

   return conditions;
}
