import { sql } from "drizzle-orm";
import {
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
   "credit_card",
   "investment",
   "cash",
   "other",
]);

export const bankAccounts = pgTable(
   "bank_accounts",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: bankAccountTypeEnum("type").notNull().default("checking"),
      color: text("color").notNull().default("#6366f1"),
      iconUrl: text("icon_url"),
      initialBalance: numeric("initial_balance", { precision: 12, scale: 2 })
         .notNull()
         .default("0"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [index("bank_accounts_team_id_idx").on(table.teamId)],
);

export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type BankAccountType = (typeof bankAccountTypeEnum.enumValues)[number];
