import { AppError, propagateError } from "@core/logging/errors";
import { and, eq, sql } from "drizzle-orm";
import dayjs from "dayjs";
import type { DatabaseInstance } from "@core/database/client";
import { creditCardStatements } from "@core/database/schemas/credit-card-statements";
import { creditCardStatementTotals } from "@core/database/schemas/credit-card-statement-totals";
import { transactions } from "@core/database/schemas/transactions";
import { bills } from "@core/database/schemas/bills";
import {
   computeClosingDate,
   computeDueDate,
} from "@core/database/helpers/credit-card-dates";

// =============================================================================
// Read
// =============================================================================

export async function getStatement(db: DatabaseInstance, id: string) {
   try {
      const [row] = await db
         .select({
            statement: creditCardStatements,
            totalPurchases: creditCardStatementTotals.totalPurchases,
            transactionCount: creditCardStatementTotals.transactionCount,
         })
         .from(creditCardStatements)
         .leftJoin(
            creditCardStatementTotals,
            and(
               eq(
                  creditCardStatements.creditCardId,
                  creditCardStatementTotals.creditCardId,
               ),
               eq(
                  creditCardStatements.statementPeriod,
                  creditCardStatementTotals.statementPeriod,
               ),
            ),
         )
         .where(eq(creditCardStatements.id, id));
      if (!row) return null;
      return {
         ...row.statement,
         totalPurchases: row.totalPurchases ?? "0",
         transactionCount: row.transactionCount ?? 0,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get statement");
   }
}

export async function listStatements(
   db: DatabaseInstance,
   creditCardId: string,
) {
   try {
      return await db
         .select({
            statement: creditCardStatements,
            totalPurchases: creditCardStatementTotals.totalPurchases,
            transactionCount: creditCardStatementTotals.transactionCount,
         })
         .from(creditCardStatements)
         .leftJoin(
            creditCardStatementTotals,
            and(
               eq(
                  creditCardStatements.creditCardId,
                  creditCardStatementTotals.creditCardId,
               ),
               eq(
                  creditCardStatements.statementPeriod,
                  creditCardStatementTotals.statementPeriod,
               ),
            ),
         )
         .where(eq(creditCardStatements.creditCardId, creditCardId))
         .orderBy(creditCardStatements.statementPeriod);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list statements");
   }
}

// =============================================================================
// Get or Create (lazy)
// =============================================================================

export async function getOrCreateStatement(
   db: DatabaseInstance,
   creditCardId: string,
   statementPeriod: string,
) {
   try {
      const existing = await db.query.creditCardStatements.findFirst({
         where: (fields, { and, eq }) =>
            and(
               eq(fields.creditCardId, creditCardId),
               eq(fields.statementPeriod, statementPeriod),
            ),
      });
      if (existing) return existing;

      const card = await db.query.creditCards.findFirst({
         where: (fields, { eq }) => eq(fields.id, creditCardId),
      });
      if (!card) throw AppError.notFound("Cartão de crédito não encontrado.");

      const closingDate = computeClosingDate(statementPeriod, card.closingDay);
      const dueDate = computeDueDate(
         statementPeriod,
         card.closingDay,
         card.dueDay,
      );

      const [statement] = await db
         .insert(creditCardStatements)
         .values({
            creditCardId,
            statementPeriod,
            closingDate,
            dueDate,
         })
         .onConflictDoNothing()
         .returning();

      // Race condition: another process may have created it
      if (!statement) {
         const found = await db.query.creditCardStatements.findFirst({
            where: (fields, { and, eq }) =>
               and(
                  eq(fields.creditCardId, creditCardId),
                  eq(fields.statementPeriod, statementPeriod),
               ),
         });
         if (!found) throw AppError.database("Failed to create statement");
         return found;
      }

      // Create a bill for the statement (contas a pagar)
      const [bill] = await db
         .insert(bills)
         .values({
            teamId: card.teamId,
            name: `Fatura ${card.name} - ${dayjs(`${statementPeriod}-01`).format("MM/YYYY")}`,
            type: "payable",
            status: "pending",
            amount: "0",
            dueDate,
            bankAccountId: card.bankAccountId,
         })
         .returning();

      if (bill) {
         await db
            .update(creditCardStatements)
            .set({ billId: bill.id })
            .where(eq(creditCardStatements.id, statement.id));
         statement.billId = bill.id;
      }

      return statement;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get or create statement");
   }
}

// =============================================================================
// Pay Statement
// =============================================================================

export async function payStatement(
   db: DatabaseInstance,
   statementId: string,
   paymentDate: string,
) {
   try {
      return await db.transaction(async (tx) => {
         // 1. Get statement with totals
         const [row] = await tx
            .select({
               statement: creditCardStatements,
               totalPurchases: creditCardStatementTotals.totalPurchases,
            })
            .from(creditCardStatements)
            .leftJoin(
               creditCardStatementTotals,
               and(
                  eq(
                     creditCardStatements.creditCardId,
                     creditCardStatementTotals.creditCardId,
                  ),
                  eq(
                     creditCardStatements.statementPeriod,
                     creditCardStatementTotals.statementPeriod,
                  ),
               ),
            )
            .where(eq(creditCardStatements.id, statementId));

         if (!row) throw AppError.notFound("Fatura não encontrada.");
         if (row.statement.status === "paid") {
            throw AppError.conflict("Fatura já está paga.");
         }

         const today = dayjs(paymentDate);
         if (today.isBefore(dayjs(row.statement.closingDate))) {
            throw AppError.validation("Fatura ainda não está fechada.");
         }

         // 2. Get credit card for account info
         const card = await tx.query.creditCards.findFirst({
            where: (fields, { eq }) =>
               eq(fields.id, row.statement.creditCardId),
         });
         if (!card) throw AppError.notFound("Cartão não encontrado.");

         const amount = row.totalPurchases ?? "0";
         const period = dayjs(`${row.statement.statementPeriod}-01`).format(
            "MM/YYYY",
         );

         // 3. Create debit transaction on linked bank account
         const [paymentTx] = await tx
            .insert(transactions)
            .values({
               teamId: card.teamId,
               name: `Pagamento fatura ${card.name} - ${period}`,
               type: "expense",
               amount,
               date: paymentDate,
               bankAccountId: card.bankAccountId,
               paymentMethod: "debit_card",
            })
            .returning();

         if (!paymentTx)
            throw AppError.database("Failed to create payment transaction");

         // 4. Update bill as paid
         if (row.statement.billId) {
            await tx
               .update(bills)
               .set({
                  status: "paid",
                  paidAt: new Date(),
                  amount,
                  transactionId: paymentTx.id,
               })
               .where(eq(bills.id, row.statement.billId));
         }

         // 5. Update statement
         const [updated] = await tx
            .update(creditCardStatements)
            .set({
               status: "paid",
               paymentTransactionId: paymentTx.id,
               updatedAt: new Date(),
            })
            .where(eq(creditCardStatements.id, statementId))
            .returning();

         return updated;
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to pay statement");
   }
}

// =============================================================================
// Available Limit
// =============================================================================

export async function getAvailableLimit(
   db: DatabaseInstance,
   creditCardId: string,
) {
   try {
      const card = await db.query.creditCards.findFirst({
         where: (fields, { eq }) => eq(fields.id, creditCardId),
      });
      if (!card) throw AppError.notFound("Cartão não encontrado.");

      const [row] = await db
         .select({
            totalPending: sql<string>`COALESCE(SUM(${creditCardStatementTotals.totalPurchases}::numeric), 0)`,
         })
         .from(creditCardStatementTotals)
         .innerJoin(
            creditCardStatements,
            and(
               eq(
                  creditCardStatementTotals.creditCardId,
                  creditCardStatements.creditCardId,
               ),
               eq(
                  creditCardStatementTotals.statementPeriod,
                  creditCardStatements.statementPeriod,
               ),
            ),
         )
         .where(
            and(
               eq(creditCardStatements.creditCardId, creditCardId),
               eq(creditCardStatements.status, "open"),
            ),
         );

      const totalPending = Number(row?.totalPending ?? "0");
      const limit = Number(card.creditLimit);
      const available = Math.max(0, limit - totalPending);

      return {
         creditLimit: card.creditLimit,
         totalPending: String(totalPending),
         availableLimit: String(available),
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to compute available limit");
   }
}
