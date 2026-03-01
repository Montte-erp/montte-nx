import type { DatabaseInstance } from "@packages/database/client";
import { transactions } from "@packages/database/schemas/transactions";
import { AppError, propagateError } from "@packages/utils/errors";
import { and, inArray, sql } from "drizzle-orm";
import { resolveDateRange, resolveDateRangeWithComparison } from "./date-ranges";
import type { KpiConfig, KpiResult, TransactionFilters } from "./types";

export async function executeKpiQuery(
  db: DatabaseInstance,
  teamId: string,
  config: KpiConfig,
): Promise<KpiResult> {
  try {
    const { start, end } = resolveDateRange(config.filters.dateRange);
    const value = await computeValue(db, teamId, config.measure.aggregation, config.filters, start, end);

    if (!config.compare) {
      return { value };
    }

    const { previous } = resolveDateRangeWithComparison(config.filters.dateRange);
    const prevValue = await computeValue(db, teamId, config.measure.aggregation, config.filters, previous.start, previous.end);
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
      .select({ value: sql<number>`coalesce(sum(${transactions.amount}), 0)::float` })
      .from(transactions)
      .where(and(...conditions));
    return Number(result[0]?.value ?? 0);
  }

  // avg
  const result = await db
    .select({ value: sql<number>`coalesce(avg(${transactions.amount}), 0)::float` })
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

  // biome-ignore lint/suspicious/noExplicitAny: drizzle condition array
  const conditions: any[] = [
    sql`${transactions.teamId} = ${teamId}`,
    sql`${transactions.date} >= ${startStr}::date`,
    sql`${transactions.date} <= ${endStr}::date`,
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
