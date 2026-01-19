import { relations, sql } from "drizzle-orm";
import {
   pgTable,
   primaryKey,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { bill } from "./bills";
import { budget } from "./budgets";
import { financialGoal } from "./goals";
import { transaction } from "./transactions";

export const tag = pgTable("tag", {
   color: text("color").notNull(),
   createdAt: timestamp("created_at").defaultNow().notNull(),
   id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
   name: text("name").notNull(),
   organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
   updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
});

export const transactionTag = pgTable(
   "transaction_tag",
   {
      tagId: uuid("tag_id")
         .notNull()
         .references(() => tag.id, { onDelete: "cascade" }),
      transactionId: uuid("transaction_id")
         .notNull()
         .references(() => transaction.id, { onDelete: "cascade" }),
   },
   (table) => ({
      pk: primaryKey({ columns: [table.transactionId, table.tagId] }),
   }),
);

export const billTag = pgTable(
   "bill_tag",
   {
      billId: uuid("bill_id")
         .notNull()
         .references(() => bill.id, { onDelete: "cascade" }),
      tagId: uuid("tag_id")
         .notNull()
         .references(() => tag.id, { onDelete: "cascade" }),
   },
   (table) => ({
      pk: primaryKey({ columns: [table.billId, table.tagId] }),
   }),
);

export const tagRelations = relations(tag, ({ one, many }) => ({
   billTags: many(billTag),
   budgets: many(budget),
   financialGoal: one(financialGoal, {
      fields: [tag.id],
      references: [financialGoal.tagId],
   }),
   organization: one(organization, {
      fields: [tag.organizationId],
      references: [organization.id],
   }),
   transactionTags: many(transactionTag),
}));

export const transactionTagRelations = relations(transactionTag, ({ one }) => ({
   tag: one(tag, {
      fields: [transactionTag.tagId],
      references: [tag.id],
   }),
   transaction: one(transaction, {
      fields: [transactionTag.transactionId],
      references: [transaction.id],
   }),
}));

export const billTagRelations = relations(billTag, ({ one }) => ({
   bill: one(bill, {
      fields: [billTag.billId],
      references: [bill.id],
   }),
   tag: one(tag, {
      fields: [billTag.tagId],
      references: [tag.id],
   }),
}));
