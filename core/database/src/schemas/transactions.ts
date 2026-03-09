import { relations, sql } from "drizzle-orm";
import {
   boolean,
   date,
   index,
   integer,
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
import { contacts } from "./contacts";
import { creditCards } from "./credit-cards";
import { services } from "./services";
import { subcategories } from "./subcategories";
import { tags } from "./tags";

export const paymentMethodEnum = pgEnum("payment_method", [
   "pix",
   "credit_card",
   "debit_card",
   "boleto",
   "cash",
   "transfer",
   "other",
   "cheque",
   "automatic_debit",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
   "income",
   "expense",
   "transfer",
]);

export const transactions = pgTable(
   "transactions",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name"),
      type: transactionTypeEnum("type").notNull(),
      amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
      description: text("description"),
      date: date("date").notNull(),
      bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
         onDelete: "restrict",
      }),
      destinationBankAccountId: uuid("destination_bank_account_id").references(
         () => bankAccounts.id,
         { onDelete: "restrict" },
      ),
      creditCardId: uuid("credit_card_id").references(() => creditCards.id, {
         onDelete: "restrict",
      }),
      categoryId: uuid("category_id").references(() => categories.id, {
         onDelete: "set null",
      }),
      subcategoryId: uuid("subcategory_id").references(() => subcategories.id, {
         onDelete: "set null",
      }),
      attachmentUrl: text("attachment_url"),
      paymentMethod: paymentMethodEnum("payment_method"),
      isInstallment: boolean("is_installment").default(false).notNull(),
      installmentCount: integer("installment_count"),
      installmentNumber: integer("installment_number"),
      installmentGroupId: uuid("installment_group_id"),
      contactId: uuid("contact_id").references(() => contacts.id, {
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
      index("transactions_team_id_idx").on(table.teamId),
      index("transactions_date_idx").on(table.date),
      index("transactions_bank_account_id_idx").on(table.bankAccountId),
      index("transactions_category_id_idx").on(table.categoryId),
      index("transactions_credit_card_id_idx").on(table.creditCardId),
      index("transactions_contact_id_idx").on(table.contactId),
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

export const transactionItems = pgTable("transaction_items", {
   id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
   transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
   serviceId: uuid("service_id").references(() => services.id, {
      onDelete: "set null",
   }),
   teamId: uuid("team_id").notNull(),
   description: text("description"),
   quantity: numeric("quantity", { precision: 12, scale: 4 })
      .notNull()
      .default("1"),
   unitPrice: numeric("unit_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
   createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
});

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
      creditCard: one(creditCards, {
         fields: [transactions.creditCardId],
         references: [creditCards.id],
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
      items: many(transactionItems),
      contact: one(contacts, {
         fields: [transactions.contactId],
         references: [contacts.id],
      }),
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

export const transactionItemsRelations = relations(
   transactionItems,
   ({ one }) => ({
      transaction: one(transactions, {
         fields: [transactionItems.transactionId],
         references: [transactions.id],
      }),
      service: one(services, {
         fields: [transactionItems.serviceId],
         references: [services.id],
      }),
   }),
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type TransactionTag = typeof transactionTags.$inferSelect;
export type NewTransactionTag = typeof transactionTags.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type NewTransactionItem = typeof transactionItems.$inferInsert;
