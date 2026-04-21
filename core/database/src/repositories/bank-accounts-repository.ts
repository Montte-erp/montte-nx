import dayjs from "dayjs";
import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { add, of, subtract, toDecimal } from "@f-o-t/money";
import { and, eq, or, sql } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateBankAccountInput,
   type UpdateBankAccountInput,
   bankAccounts,
   createBankAccountSchema,
   updateBankAccountSchema,
} from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";

export async function createBankAccount(
   db: DatabaseInstance,
   teamId: string,
   data: CreateBankAccountInput,
) {
   const validated = validateInput(createBankAccountSchema, data);
   try {
      const [account] = await db
         .insert(bankAccounts)
         .values({ ...validated, teamId })
         .returning();
      if (!account) throw AppError.database("Failed to create bank account");
      return account;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bank account");
   }
}

export async function bulkCreateBankAccounts(
   db: DatabaseInstance,
   teamId: string,
   items: CreateBankAccountInput[],
) {
   const validated = items.map((item) =>
      validateInput(createBankAccountSchema, item),
   );
   try {
      const rows = await db
         .insert(bankAccounts)
         .values(validated.map((v) => ({ ...v, teamId })))
         .returning();
      return rows;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to bulk create bank accounts");
   }
}

export async function listBankAccounts(
   db: DatabaseInstance,
   teamId: string,
   includeArchived = false,
) {
   try {
      if (includeArchived) {
         return await db.query.bankAccounts.findMany({
            where: (fields, { eq }) => eq(fields.teamId, teamId),
            orderBy: (fields, { asc }) => [asc(fields.name)],
         });
      }
      return await db.query.bankAccounts.findMany({
         where: (fields, { and, eq }) =>
            and(eq(fields.teamId, teamId), eq(fields.status, "active")),
         orderBy: (fields, { asc }) => [asc(fields.name)],
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list bank accounts");
   }
}

export async function getBankAccount(db: DatabaseInstance, id: string) {
   try {
      const account = await db.query.bankAccounts.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      });
      return account ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get bank account");
   }
}

export async function ensureBankAccountOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   const account = await getBankAccount(db, id);
   if (!account || account.teamId !== teamId) {
      throw AppError.notFound("Conta bancária não encontrada.");
   }
   return account;
}

export async function updateBankAccount(
   db: DatabaseInstance,
   id: string,
   data: UpdateBankAccountInput,
) {
   const validated = validateInput(updateBankAccountSchema, data);
   try {
      const [updated] = await db
         .update(bankAccounts)
         .set({ ...validated, updatedAt: dayjs().toDate() })
         .where(eq(bankAccounts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Conta bancária não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update bank account");
   }
}

export async function archiveBankAccount(db: DatabaseInstance, id: string) {
   try {
      const [updated] = await db
         .update(bankAccounts)
         .set({ status: "archived", updatedAt: dayjs().toDate() })
         .where(eq(bankAccounts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Conta bancária não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive bank account");
   }
}

export async function reactivateBankAccount(db: DatabaseInstance, id: string) {
   try {
      const [updated] = await db
         .update(bankAccounts)
         .set({ status: "active", updatedAt: dayjs().toDate() })
         .where(eq(bankAccounts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Conta bancária não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to reactivate bank account");
   }
}

export async function deleteBankAccount(db: DatabaseInstance, id: string) {
   try {
      const hasTransactions = await bankAccountHasTransactions(db, id);
      if (hasTransactions) {
         throw AppError.conflict(
            "Conta com lançamentos não pode ser excluída. Use arquivamento.",
         );
      }
      await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete bank account");
   }
}

export async function computeBankAccountBalance(
   db: DatabaseInstance,
   accountId: string,
   initialBalance: string,
) {
   try {
      const currency = "BRL";

      const [row] = await db
         .select({
            income: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount::numeric ELSE 0 END), 0)`,
            expense: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount::numeric ELSE 0 END), 0)`,
            transferOut: sql<string>`COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount::numeric ELSE 0 END), 0)`,
         })
         .from(transactions)
         .where(eq(transactions.bankAccountId, accountId));

      const [transferInRow] = await db
         .select({
            transferIn: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
         })
         .from(transactions)
         .where(
            and(
               eq(transactions.destinationBankAccountId, accountId),
               eq(transactions.type, "transfer"),
            ),
         );

      let balance = of(initialBalance, currency);
      balance = add(balance, of(row?.income ?? "0", currency));
      balance = subtract(balance, of(row?.expense ?? "0", currency));
      balance = subtract(balance, of(row?.transferOut ?? "0", currency));
      balance = add(balance, of(transferInRow?.transferIn ?? "0", currency));

      const [pendingRow] = await db
         .select({
            pendingReceivable: sql<string>`COALESCE(SUM(CASE WHEN type = 'income' AND status = 'pending' THEN amount::numeric ELSE 0 END), 0)`,
            pendingPayable: sql<string>`COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'pending' THEN amount::numeric ELSE 0 END), 0)`,
         })
         .from(transactions)
         .where(eq(transactions.bankAccountId, accountId));

      let projected = balance;
      projected = add(
         projected,
         of(pendingRow?.pendingReceivable ?? "0", currency),
      );
      projected = subtract(
         projected,
         of(pendingRow?.pendingPayable ?? "0", currency),
      );

      return {
         currentBalance: toDecimal(balance),
         projectedBalance: toDecimal(projected),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to compute bank account balance");
   }
}

export async function listBankAccountsWithBalance(
   db: DatabaseInstance,
   teamId: string,
   includeArchived = false,
) {
   try {
      const accounts = await listBankAccounts(db, teamId, includeArchived);

      return await Promise.all(
         accounts.map(async (account) => {
            const { currentBalance, projectedBalance } =
               await computeBankAccountBalance(
                  db,
                  account.id,
                  account.initialBalance,
               );
            return { ...account, currentBalance, projectedBalance };
         }),
      );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list bank accounts with balance");
   }
}

export async function bankAccountHasTransactions(
   db: DatabaseInstance,
   accountId: string,
) {
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
