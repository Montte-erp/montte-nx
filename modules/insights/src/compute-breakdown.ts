import type { DatabaseInstance } from "@core/database/client";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
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

async function computeTotal(
   db: DatabaseInstance,
   teamId: string,
   config: BreakdownConfig,
   start: Date,
   end: Date,
): Promise<number> {
   const conditions = buildConditions(teamId, config.filters, start, end);
   const result = await db
      .select({ value: aggregationExpr(config.measure.aggregation) })
      .from(transactions)
      .where(and(...conditions));
   return Number(result[0]?.value ?? 0);
}

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

      let rows: BreakdownItem[] = [];

      switch (config.groupBy) {
         case "category":
         case "subcategory": {
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
               .orderBy(desc(valueExpr))
               .limit(limit);
            rows = results.map((r) => ({
               label:
                  TRANSACTION_TYPE_LABELS[r.label ?? ""] ??
                  r.label ??
                  "Desconhecido",
               value: Number(r.value),
            }));
            break;
         }
      }

      const total = await computeTotal(db, teamId, config, start, end);
      return { data: rows, total };
   } catch (err) {
      propagateError(err);
      throw AppError.internal("Failed to execute breakdown query", {
         cause: err,
      });
   }
}
