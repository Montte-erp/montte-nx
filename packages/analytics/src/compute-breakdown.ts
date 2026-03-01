import type { DatabaseInstance } from "@packages/database/client";
import { bankAccounts } from "@packages/database/schemas/bank-accounts";
import { categories } from "@packages/database/schemas/categories";
import { subcategories } from "@packages/database/schemas/subcategories";
import { transactions } from "@packages/database/schemas/transactions";
import { AppError, propagateError } from "@packages/utils/errors";
import { and, desc, eq, sql } from "drizzle-orm";
import { buildConditions } from "./compute-kpi";
import { resolveDateRange } from "./date-ranges";
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

    let valueExpr = sql<number>`count(*)::int`;
    if (config.measure.aggregation === "sum") {
      valueExpr = sql<number>`coalesce(sum(${transactions.amount}), 0)::float`;
    } else if (config.measure.aggregation === "avg") {
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
        rows = results.map((r) => ({ label: r.label, value: Number(r.value), color: r.color }));
        break;
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
        rows = results.map((r) => ({ label: r.label, value: Number(r.value) }));
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
          label: typeLabels[r.label ?? ""] ?? r.label ?? "Desconhecido",
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
          .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
          .where(and(...conditions))
          .groupBy(subcategories.id, subcategories.name)
          .orderBy(desc(valueExpr))
          .limit(limit);
        rows = results.map((r) => ({ label: r.label, value: Number(r.value) }));
        break;
      }
    }

    const total = rows.reduce((sum, item) => sum + item.value, 0);
    return { data: rows, total };
  } catch (err) {
    propagateError(err);
    throw AppError.internal("Failed to execute breakdown query", { cause: err });
  }
}
