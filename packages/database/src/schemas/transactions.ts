import { relations, sql } from "drizzle-orm";
import {
   decimal,
   index,
   integer,
   jsonb,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { bankAccount } from "./bank-accounts";
import { transactionCategory } from "./categories";
import { costCenter } from "./cost-centers";
import { transactionTag } from "./tags";

export type CategorySplit = {
   categoryId: string;
   value: number;
   splitType: "amount";
};

export const transaction = pgTable(
   "transaction",
   {
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      attachmentKey: text("attachment_key"),
      bankAccountId: uuid("bank_account_id").references(() => bankAccount.id, {
         onDelete: "cascade",
      }),
      categorySplits: jsonb("category_splits").$type<CategorySplit[]>(),
      costCenterId: uuid("cost_center_id").references(() => costCenter.id, {
         onDelete: "set null",
      }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      date: timestamp("date").notNull(),
      description: text("description").notNull(),
      externalId: text("external_id"),
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      searchIndex: text("search_index"),
      type: text("type").notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [
      index("transaction_organizationId_idx").on(table.organizationId),
      index("transaction_searchIndex_idx").on(table.searchIndex),
   ],
);

export const transactionAttachment = pgTable("transaction_attachment", {
   contentType: text("content_type").notNull(),
   createdAt: timestamp("created_at").defaultNow().notNull(),
   fileName: text("file_name").notNull(),
   fileSize: integer("file_size"),
   id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
   storageKey: text("storage_key").notNull(),
   transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
   updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
});

export const transactionAttachmentRelations = relations(
   transactionAttachment,
   ({ one }) => ({
      transaction: one(transaction, {
         fields: [transactionAttachment.transactionId],
         references: [transaction.id],
      }),
   }),
);

export const transactionRelations = relations(transaction, ({ one, many }) => ({
   attachments: many(transactionAttachment),
   bankAccount: one(bankAccount, {
      fields: [transaction.bankAccountId],
      references: [bankAccount.id],
   }),
   costCenter: one(costCenter, {
      fields: [transaction.costCenterId],
      references: [costCenter.id],
   }),
   organization: one(organization, {
      fields: [transaction.organizationId],
      references: [organization.id],
   }),
   transactionCategories: many(transactionCategory),
   transactionTags: many(transactionTag),
}));
