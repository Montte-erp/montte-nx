import { sql } from "drizzle-orm";
import {
   date,
   index,
   numeric,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";

export const bankAccountTypeEnum = pgEnum("bank_account_type", [
   "checking",
   "savings",
   "investment",
   "payment",
   "cash",
]);

export const bankAccountStatusEnum = pgEnum("bank_account_status", [
   "active",
   "archived",
]);

export const bankAccounts = pgTable(
   "bank_accounts",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: bankAccountTypeEnum("type").notNull().default("checking"),
      status: bankAccountStatusEnum("status").notNull().default("active"),
      color: text("color").notNull().default("#6366f1"),
      iconUrl: text("icon_url"),
      bankCode: text("bank_code"),
      bankName: text("bank_name"),
      branch: text("branch"),
      accountNumber: text("account_number"),
      initialBalance: numeric("initial_balance", { precision: 12, scale: 2 })
         .notNull()
         .default("0"),
      initialBalanceDate: date("initial_balance_date"),
      notes: text("notes"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("bank_accounts_team_id_idx").on(table.teamId),
      index("bank_accounts_status_idx").on(table.status),
   ],
);

export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type BankAccountType = (typeof bankAccountTypeEnum.enumValues)[number];
export type BankAccountStatus =
   (typeof bankAccountStatusEnum.enumValues)[number];
