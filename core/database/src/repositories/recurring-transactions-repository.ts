import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   recurringTransactions,
   transactions,
   type NewRecurringTransaction,
} from "@core/database/schemas/transactions";
import { z } from "zod";

const createRecurringTransactionInputSchema = z.object({
   teamId: z.string().uuid(),
   name: z.string().min(2).max(200).nullable().optional(),
   type: z.enum(["income", "expense", "transfer"]),
   amount: z.string(),
   description: z.string().max(500).nullable().optional(),
   bankAccountId: z.string().uuid().nullable().optional(),
   destinationBankAccountId: z.string().uuid().nullable().optional(),
   creditCardId: z.string().uuid().nullable().optional(),
   categoryId: z.string().uuid().nullable().optional(),
   contactId: z.string().uuid().nullable().optional(),
   paymentMethod: z.string().nullable().optional(),
   frequency: z.enum(["daily", "weekly", "monthly"]),
   startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
   endsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
   windowMonths: z.number().int().min(1).max(24).default(3),
});

export async function createRecurringTransaction(
   db: DatabaseInstance,
   input: z.infer<typeof createRecurringTransactionInputSchema>,
) {
   const data = validateInput(createRecurringTransactionInputSchema, input);
   try {
      const [row] = await db
         .insert(recurringTransactions)
         .values(data as NewRecurringTransaction)
         .returning();
      if (!row)
         throw AppError.database("Failed to create recurring transaction");
      return row;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create recurring transaction");
   }
}

export async function getRecurringTransactionsByTeam(
   db: DatabaseInstance,
   teamId: string,
) {
   return db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.teamId, teamId))
      .orderBy(desc(recurringTransactions.createdAt));
}

export async function getActiveRecurringTransactions(db: DatabaseInstance) {
   const today = new Date().toISOString().substring(0, 10);
   return db
      .select()
      .from(recurringTransactions)
      .where(
         and(
            eq(recurringTransactions.isActive, true),
            lte(recurringTransactions.startDate, today),
            or(
               isNull(recurringTransactions.endsAt),
               gte(recurringTransactions.endsAt, today),
            ),
         ),
      );
}

export async function deleteRecurringTransaction(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   try {
      const [row] = await db
         .delete(recurringTransactions)
         .where(
            and(
               eq(recurringTransactions.id, id),
               eq(recurringTransactions.teamId, teamId),
            ),
         )
         .returning();
      if (!row) throw AppError.notFound("Recurring transaction not found");
      return row;
   } catch (err) {
      propagateError(err);
      throw AppError.notFound("Recurring transaction not found");
   }
}

export async function getLastGeneratedTransactionForRule(
   db: DatabaseInstance,
   recurringTransactionId: string,
) {
   const [row] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.recurringTransactionId, recurringTransactionId))
      .orderBy(desc(transactions.date))
      .limit(1);
   return row ?? null;
}
