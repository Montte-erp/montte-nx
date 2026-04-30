import { of, toDecimal } from "@f-o-t/money";
import { or, eq, sql } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import { transactions } from "@core/database/schemas/transactions";

export async function computeBankAccountBalance(
   db: DatabaseInstance,
   accountId: string,
   initialBalance: string,
) {
   const t = transactions;
   const [row] = await db
      .select({
         income: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'income' AND ${t.bankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
         expense: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'expense' AND ${t.bankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
         transferOut: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'transfer' AND ${t.bankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
         transferIn: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'transfer' AND ${t.destinationBankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
         pendingReceivable: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'income' AND ${t.status} = 'pending' AND ${t.bankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
         pendingPayable: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'expense' AND ${t.status} = 'pending' AND ${t.bankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
      })
      .from(t)
      .where(
         or(
            eq(t.bankAccountId, accountId),
            eq(t.destinationBankAccountId, accountId),
         ),
      );

   const currency = "BRL";
   const num = (v: string | undefined) => Number(v ?? 0);
   const current =
      Number(initialBalance) +
      num(row?.income) -
      num(row?.expense) -
      num(row?.transferOut) +
      num(row?.transferIn);
   const projected =
      current + num(row?.pendingReceivable) - num(row?.pendingPayable);

   return {
      currentBalance: toDecimal(of(current.toFixed(2), currency)),
      projectedBalance: toDecimal(of(projected.toFixed(2), currency)),
   };
}
