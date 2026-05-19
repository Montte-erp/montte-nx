import { add, of, subtract, toDecimal } from "@f-o-t/money";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";

type BankAccountBalanceInput = Pick<
   typeof bankAccounts.$inferSelect,
   "id" | "initialBalance"
>;

type BankAccountBalances = {
   currentBalance: string;
   projectedBalance: string;
};

function normalizeBalance(value: string | undefined) {
   return toDecimal(of(value ?? "0", "BRL"));
}

export function buildBankAccountBalanceSql(includePending: boolean) {
   const a = bankAccounts;
   const t = transactions;
   const currentBalanceSql = sql<string>`
      (
         ${a.initialBalance}
         + COALESCE(SUM(CASE WHEN ${t.status} = 'paid' AND ${t.type} = 'income' AND ${t.bankAccountId} = ${a.id} THEN ${t.amount} ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN ${t.status} = 'paid' AND ${t.type} = 'expense' AND ${t.bankAccountId} = ${a.id} THEN ${t.amount} ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN ${t.status} = 'paid' AND ${t.type} = 'transfer' AND ${t.bankAccountId} = ${a.id} THEN ${t.amount} ELSE 0 END), 0)
         + COALESCE(SUM(CASE WHEN ${t.status} = 'paid' AND ${t.type} = 'transfer' AND ${t.destinationBankAccountId} = ${a.id} THEN ${t.amount} ELSE 0 END), 0)
      )
   `;

   if (!includePending) return currentBalanceSql;

   return sql<string>`
      (
         ${currentBalanceSql}
         + COALESCE(SUM(CASE WHEN ${t.type} = 'income' AND ${t.status} = 'pending' AND ${t.bankAccountId} = ${a.id} THEN ${t.amount} ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN ${t.type} = 'expense' AND ${t.status} = 'pending' AND ${t.bankAccountId} = ${a.id} THEN ${t.amount} ELSE 0 END), 0)
      )
   `;
}

export async function computeBankAccountBalance(
   db: DatabaseInstance,
   accountId: string,
   initialBalance: string,
) {
   const t = transactions;
   const [row] = await db
      .select({
         income: sql<string>`COALESCE(SUM(CASE WHEN ${t.status} = 'paid' AND ${t.type} = 'income' AND ${t.bankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
         expense: sql<string>`COALESCE(SUM(CASE WHEN ${t.status} = 'paid' AND ${t.type} = 'expense' AND ${t.bankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
         transferOut: sql<string>`COALESCE(SUM(CASE WHEN ${t.status} = 'paid' AND ${t.type} = 'transfer' AND ${t.bankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
         transferIn: sql<string>`COALESCE(SUM(CASE WHEN ${t.status} = 'paid' AND ${t.type} = 'transfer' AND ${t.destinationBankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
         pendingReceivable: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'income' AND ${t.status} = 'pending' AND ${t.bankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
         pendingPayable: sql<string>`COALESCE(SUM(CASE WHEN ${t.type} = 'expense' AND ${t.status} = 'pending' AND ${t.bankAccountId} = ${accountId} THEN ${t.amount} ELSE 0 END), 0)`,
      })
      .from(t)
      .where(
         and(
            or(
               eq(t.bankAccountId, accountId),
               eq(t.destinationBankAccountId, accountId),
            ),
            eq(t.ignored, false),
         ),
      );

   const currency = "BRL";
   const current = add(
      subtract(
         subtract(
            add(of(initialBalance, currency), of(row?.income ?? "0", currency)),
            of(row?.expense ?? "0", currency),
         ),
         of(row?.transferOut ?? "0", currency),
      ),
      of(row?.transferIn ?? "0", currency),
   );
   const projected = subtract(
      add(current, of(row?.pendingReceivable ?? "0", currency)),
      of(row?.pendingPayable ?? "0", currency),
   );

   return {
      currentBalance: toDecimal(current),
      projectedBalance: toDecimal(projected),
   };
}

export async function computeBankAccountBalances(
   db: DatabaseInstance,
   accounts: BankAccountBalanceInput[],
): Promise<Map<string, BankAccountBalances>> {
   if (accounts.length === 0) return new Map();

   const ids = accounts.map((account) => account.id);
   const a = bankAccounts;
   const t = transactions;
   const currentBalanceSql = sql<string>`${buildBankAccountBalanceSql(false)}::text`;
   const projectedBalanceSql = sql<string>`${buildBankAccountBalanceSql(true)}::text`;

   const rows = await db
      .select({
         accountId: a.id,
         currentBalance: currentBalanceSql,
         projectedBalance: projectedBalanceSql,
      })
      .from(a)
      .leftJoin(
         t,
         and(
            or(eq(t.bankAccountId, a.id), eq(t.destinationBankAccountId, a.id)),
            eq(t.ignored, false),
         ),
      )
      .where(inArray(a.id, ids))
      .groupBy(a.id, a.initialBalance);

   return new Map(
      rows.map((row) => [
         row.accountId,
         {
            currentBalance: normalizeBalance(row.currentBalance),
            projectedBalance: normalizeBalance(row.projectedBalance),
         },
      ]),
   );
}
