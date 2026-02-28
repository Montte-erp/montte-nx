import { AppError, propagateError } from "@packages/utils/errors";
import { and, desc, eq, or, sql, sum } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { bankAccounts, type NewBankAccount, transactions } from "../schema";

export async function createBankAccount(
   db: DatabaseInstance,
   data: NewBankAccount,
) {
   try {
      const [account] = await db.insert(bankAccounts).values(data).returning();
      return account;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bank account");
   }
}

export async function listBankAccounts(db: DatabaseInstance, teamId: string) {
   try {
      return await db
         .select()
         .from(bankAccounts)
         .where(eq(bankAccounts.teamId, teamId))
         .orderBy(desc(bankAccounts.createdAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list bank accounts");
   }
}

export async function getBankAccount(db: DatabaseInstance, id: string) {
   try {
      const [account] = await db
         .select()
         .from(bankAccounts)
         .where(eq(bankAccounts.id, id));
      return account ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get bank account");
   }
}

export async function computeBankAccountBalance(
   db: DatabaseInstance,
   accountId: string,
   initialBalance: string,
): Promise<number> {
   try {
      const [incomeRow] = await db
         .select({ total: sum(transactions.amount) })
         .from(transactions)
         .where(
            and(
               eq(transactions.bankAccountId, accountId),
               eq(transactions.type, "income"),
            ),
         );
      const [expenseRow] = await db
         .select({ total: sum(transactions.amount) })
         .from(transactions)
         .where(
            and(
               eq(transactions.bankAccountId, accountId),
               eq(transactions.type, "expense"),
            ),
         );
      const [transferOutRow] = await db
         .select({ total: sum(transactions.amount) })
         .from(transactions)
         .where(
            and(
               eq(transactions.bankAccountId, accountId),
               eq(transactions.type, "transfer"),
            ),
         );
      const [transferInRow] = await db
         .select({ total: sum(transactions.amount) })
         .from(transactions)
         .where(
            and(
               eq(transactions.destinationBankAccountId, accountId),
               eq(transactions.type, "transfer"),
            ),
         );

      return (
         Number(initialBalance) +
         Number(incomeRow?.total ?? 0) -
         Number(expenseRow?.total ?? 0) -
         Number(transferOutRow?.total ?? 0) +
         Number(transferInRow?.total ?? 0)
      );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to compute bank account balance");
   }
}

export async function updateBankAccount(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewBankAccount>,
) {
   try {
      const [updated] = await db
         .update(bankAccounts)
         .set(data)
         .where(eq(bankAccounts.id, id))
         .returning();

      if (!updated) {
         throw AppError.database("Bank account not found");
      }

      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update bank account");
   }
}

export async function deleteBankAccount(db: DatabaseInstance, id: string) {
   try {
      await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete bank account");
   }
}

export async function bankAccountHasTransactions(
   db: DatabaseInstance,
   accountId: string,
): Promise<boolean> {
   try {
      const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactions)
         .where(
            or(
               eq(transactions.bankAccountId, accountId),
               eq(transactions.destinationBankAccountId, accountId),
            ),
         );
      return (row?.count ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check bank account transactions");
   }
}
