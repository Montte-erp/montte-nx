import {
   boolean,
   integer,
   timestamp,
   uuid,
   varchar,
} from "drizzle-orm/pg-core";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { financeSchema } from "@core/database/schemas/schemas";

export const financialSettings = financeSchema.table("financial_settings", {
   teamId: uuid("team_id").primaryKey(),
   defaultCurrency: varchar("default_currency", { length: 3 })
      .notNull()
      .default("BRL"),
   fiscalYearStartMonth: integer("fiscal_year_start_month")
      .notNull()
      .default(1),
   defaultPaymentDueDays: integer("default_payment_due_days")
      .notNull()
      .default(30),
   autoCategorizationEnabled: boolean("auto_categorization_enabled")
      .notNull()
      .default(true),
   defaultIncomeBankAccountId: uuid(
      "default_income_bank_account_id",
   ).references(() => bankAccounts.id, { onDelete: "set null" }),
   defaultExpenseBankAccountId: uuid(
      "default_expense_bank_account_id",
   ).references(() => bankAccounts.id, { onDelete: "set null" }),
   createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
   updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
});

export type FinancialSettings = typeof financialSettings.$inferSelect;
export type NewFinancialSettings = typeof financialSettings.$inferInsert;
