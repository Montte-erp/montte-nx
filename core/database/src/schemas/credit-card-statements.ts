import { sql } from "drizzle-orm";
import {
   date,
   index,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { financeSchema } from "@core/database/schemas/schemas";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { bills } from "@core/database/schemas/bills";
import { creditCards } from "@core/database/schemas/credit-cards";
import { transactions } from "@core/database/schemas/transactions";

// =============================================================================
// Enums
// =============================================================================

export const creditCardStatementStatusEnum = financeSchema.enum(
   "credit_card_statement_status",
   ["open", "paid"],
);

// =============================================================================
// Table
// =============================================================================

export const creditCardStatements = financeSchema.table(
   "credit_card_statements",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      creditCardId: uuid("credit_card_id")
         .notNull()
         .references(() => creditCards.id, { onDelete: "restrict" }),
      statementPeriod: text("statement_period").notNull(),
      closingDate: date("closing_date").notNull(),
      dueDate: date("due_date").notNull(),
      status: creditCardStatementStatusEnum("status").notNull().default("open"),
      billId: uuid("bill_id").references(() => bills.id, {
         onDelete: "set null",
      }),
      paymentTransactionId: uuid("payment_transaction_id").references(
         () => transactions.id,
         { onDelete: "set null" },
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("credit_card_statements_credit_card_id_idx").on(table.creditCardId),
      uniqueIndex("credit_card_statements_card_period_idx").on(
         table.creditCardId,
         table.statementPeriod,
      ),
   ],
);

// =============================================================================
// Types
// =============================================================================

export type CreditCardStatement = typeof creditCardStatements.$inferSelect;
export type NewCreditCardStatement = typeof creditCardStatements.$inferInsert;
export type CreditCardStatementStatus =
   (typeof creditCardStatementStatusEnum.enumValues)[number];

// =============================================================================
// Validators
// =============================================================================

const STATEMENT_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const baseStatementSchema = createInsertSchema(creditCardStatements).pick({
   creditCardId: true,
   statementPeriod: true,
   closingDate: true,
   dueDate: true,
});

export const createStatementSchema = baseStatementSchema.extend({
   creditCardId: z.string().uuid(),
   statementPeriod: z
      .string()
      .regex(
         STATEMENT_PERIOD_REGEX,
         "Competência deve estar no formato YYYY-MM.",
      ),
   closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
   dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
});

export type CreateStatementInput = z.infer<typeof createStatementSchema>;
