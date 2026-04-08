import { sql } from "drizzle-orm";
import { financeSchema } from "@core/database/schemas/schemas";
import { transactions } from "@core/database/schemas/transactions";

export const creditCardStatementTotals = financeSchema
   .materializedView("credit_card_statement_totals")
   .as((qb) =>
      qb
         .select({
            creditCardId: transactions.creditCardId,
            statementPeriod: transactions.statementPeriod,
            totalPurchases:
               sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`.as(
                  "total_purchases",
               ),
            transactionCount: sql<number>`COUNT(*)::int`.as(
               "transaction_count",
            ),
         })
         .from(transactions)
         .where(sql`${transactions.creditCardId} IS NOT NULL`)
         .groupBy(transactions.creditCardId, transactions.statementPeriod),
   );
