import { relations, sql } from "drizzle-orm";
import {
   date,
   index,
   numeric,
   pgEnum,
   pgTable,
   primaryKey,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { bankAccounts } from "./bank-accounts";
import { categories } from "./categories";
import { subcategories } from "./subcategories";
import { tags } from "./tags";

export const transactionTypeEnum = pgEnum("transaction_type", [
   "income",
   "expense",
   "transfer",
]);

export const transactions = pgTable(
   "transactions",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      type: transactionTypeEnum("type").notNull(),
      amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
      description: text("description"),
      date: date("date").notNull(),
      bankAccountId: uuid("bank_account_id")
         .notNull()
         .references(() => bankAccounts.id, { onDelete: "restrict" }),
      destinationBankAccountId: uuid("destination_bank_account_id").references(
         () => bankAccounts.id,
         { onDelete: "restrict" },
      ),
      categoryId: uuid("category_id").references(() => categories.id, {
         onDelete: "set null",
      }),
      subcategoryId: uuid("subcategory_id").references(() => subcategories.id, {
         onDelete: "set null",
      }),
      attachmentUrl: text("attachment_url"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("transactions_team_id_idx").on(table.teamId),
      index("transactions_date_idx").on(table.date),
      index("transactions_bank_account_id_idx").on(table.bankAccountId),
      index("transactions_category_id_idx").on(table.categoryId),
   ],
);

export const transactionTags = pgTable(
   "transaction_tags",
   {
      transactionId: uuid("transaction_id")
         .notNull()
         .references(() => transactions.id, { onDelete: "cascade" }),
      tagId: uuid("tag_id")
         .notNull()
         .references(() => tags.id, { onDelete: "cascade" }),
   },
   (table) => [primaryKey({ columns: [table.transactionId, table.tagId] })],
);

export const transactionsRelations = relations(
   transactions,
   ({ one, many }) => ({
      bankAccount: one(bankAccounts, {
         fields: [transactions.bankAccountId],
         references: [bankAccounts.id],
         relationName: "sourceAccount",
      }),
      destinationBankAccount: one(bankAccounts, {
         fields: [transactions.destinationBankAccountId],
         references: [bankAccounts.id],
         relationName: "destinationAccount",
      }),
      category: one(categories, {
         fields: [transactions.categoryId],
         references: [categories.id],
      }),
      subcategory: one(subcategories, {
         fields: [transactions.subcategoryId],
         references: [subcategories.id],
      }),
      transactionTags: many(transactionTags),
   }),
);

export const transactionTagsRelations = relations(
   transactionTags,
   ({ one }) => ({
      transaction: one(transactions, {
         fields: [transactionTags.transactionId],
         references: [transactions.id],
      }),
      tag: one(tags, {
         fields: [transactionTags.tagId],
         references: [tags.id],
      }),
   }),
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type TransactionTag = typeof transactionTags.$inferSelect;
export type NewTransactionTag = typeof transactionTags.$inferInsert;
