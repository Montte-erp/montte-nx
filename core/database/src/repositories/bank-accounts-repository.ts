import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { add, of, subtract, toDecimal } from "@f-o-t/money";
import { and, eq, or, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { type BankAccount, bankAccounts } from "../schemas/bank-accounts";
import {
   type CreateBankAccountInput,
   type UpdateBankAccountInput,
   createBankAccountSchema,
   updateBankAccountSchema,
} from "../schemas/bank-accounts.validators";
import { bills } from "../schemas/bills";
import { transactions } from "../schemas/transactions";

// =============================================================================
// Helpers — date conversion
// =============================================================================

function toDateString(date: Date | null | undefined): string | null {
   if (!date) return null;
   return date.toISOString().substring(0, 10);
}

// =============================================================================
// Create
// =============================================================================

export interface CreateBankAccountParams {
   teamId: string;
   data: CreateBankAccountInput;
}

export async function createBankAccount(
   db: DatabaseInstance,
   params: CreateBankAccountParams,
): Promise<BankAccount> {
   const validated = validateInput(createBankAccountSchema, params.data);
   try {
      const [account] = await db
         .insert(bankAccounts)
         .values({
            ...validated,
            teamId: params.teamId,
            initialBalanceDate: toDateString(validated.initialBalanceDate),
         })
         .returning();
      if (!account) throw AppError.database("Failed to create bank account");
      return account;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bank account");
   }
}

// =============================================================================
// Read
// =============================================================================

export interface ListBankAccountsOptions {
   teamId: string;
   includeArchived?: boolean;
}

export async function listBankAccounts(
   db: DatabaseInstance,
   options: ListBankAccountsOptions,
): Promise<BankAccount[]> {
   try {
      const conditions = [eq(bankAccounts.teamId, options.teamId)];
      if (!options.includeArchived) {
         conditions.push(eq(bankAccounts.status, "active"));
      }
      return await db
         .select()
         .from(bankAccounts)
         .where(and(...conditions))
         .orderBy(bankAccounts.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list bank accounts");
   }
}

export async function getBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<BankAccount | null> {
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

// =============================================================================
// Update
// =============================================================================

export interface UpdateBankAccountParams {
   id: string;
   data: UpdateBankAccountInput;
}

export async function updateBankAccount(
   db: DatabaseInstance,
   params: UpdateBankAccountParams,
): Promise<BankAccount> {
   const validated = validateInput(updateBankAccountSchema, params.data);
   try {
      const [updated] = await db
         .update(bankAccounts)
         .set({
            ...validated,
            updatedAt: new Date(),
            initialBalanceDate: toDateString(validated.initialBalanceDate),
         })
         .where(eq(bankAccounts.id, params.id))
         .returning();
      if (!updated) throw AppError.notFound("Conta bancária não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update bank account");
   }
}

// =============================================================================
// Archive / Reactivate
// =============================================================================

export async function archiveBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<BankAccount> {
   try {
      const [updated] = await db
         .update(bankAccounts)
         .set({ status: "archived", updatedAt: new Date() })
         .where(eq(bankAccounts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Conta bancária não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive bank account");
   }
}

export async function reactivateBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<BankAccount> {
   try {
      const [updated] = await db
         .update(bankAccounts)
         .set({ status: "active", updatedAt: new Date() })
         .where(eq(bankAccounts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Conta bancária não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to reactivate bank account");
   }
}

// =============================================================================
// Delete (only if no transactions)
// =============================================================================

export async function deleteBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<void> {
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

// =============================================================================
// Balance Computation (using @f-o-t/money)
// =============================================================================

export interface BankAccountWithBalance extends BankAccount {
   currentBalance: string;
   projectedBalance: string;
}

export async function computeBankAccountBalance(
   db: DatabaseInstance,
   accountId: string,
   initialBalance: string,
): Promise<{ currentBalance: string; projectedBalance: string }> {
   try {
      const currency = "BRL";

      // Transaction aggregates
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

      // Balance using @f-o-t/money — precise BigInt arithmetic
      let balance = of(initialBalance, currency);
      balance = add(balance, of(row?.income ?? "0", currency));
      balance = subtract(balance, of(row?.expense ?? "0", currency));
      balance = subtract(balance, of(row?.transferOut ?? "0", currency));
      balance = add(balance, of(transferInRow?.transferIn ?? "0", currency));

      // Projected: current + pending receivables - pending payables
      const [billsRow] = await db
         .select({
            pendingReceivable: sql<string>`COALESCE(SUM(CASE WHEN type = 'receivable' AND status = 'pending' THEN amount::numeric ELSE 0 END), 0)`,
            pendingPayable: sql<string>`COALESCE(SUM(CASE WHEN type = 'payable' AND status = 'pending' THEN amount::numeric ELSE 0 END), 0)`,
         })
         .from(bills)
         .where(eq(bills.bankAccountId, accountId));

      let projected = balance;
      projected = add(
         projected,
         of(billsRow?.pendingReceivable ?? "0", currency),
      );
      projected = subtract(
         projected,
         of(billsRow?.pendingPayable ?? "0", currency),
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
   options: ListBankAccountsOptions,
): Promise<BankAccountWithBalance[]> {
   try {
      const accounts = await listBankAccounts(db, options);

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

// =============================================================================
// Helpers
// =============================================================================

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
