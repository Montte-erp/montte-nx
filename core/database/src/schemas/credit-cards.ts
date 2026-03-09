import { sql } from "drizzle-orm";
import {
   index,
   integer,
   numeric,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { bankAccounts } from "./bank-accounts";

export const creditCards = pgTable(
   "credit_cards",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull().default("#6366f1"),
      iconUrl: text("icon_url"),
      creditLimit: numeric("credit_limit", { precision: 12, scale: 2 })
         .notNull()
         .default("0"),
      closingDay: integer("closing_day").notNull(),
      dueDay: integer("due_day").notNull(),
      bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
         onDelete: "set null",
      }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("credit_cards_team_id_idx").on(table.teamId),
      index("credit_cards_bank_account_id_idx").on(table.bankAccountId),
   ],
);

export type CreditCard = typeof creditCards.$inferSelect;
export type NewCreditCard = typeof creditCards.$inferInsert;
