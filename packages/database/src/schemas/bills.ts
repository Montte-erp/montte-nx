import { relations, sql } from "drizzle-orm";
import {
   boolean,
   decimal,
   index,
   integer,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { bankAccount } from "./bank-accounts";
import { costCenter } from "./cost-centers";
import { counterparty } from "./counterparties";
import { interestTemplate } from "./interest-templates";
import { billTag } from "./tags";
import { transaction } from "./transactions";

export const bill = pgTable(
   "bill",
   {
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      appliedCorrection: decimal("applied_correction", {
         precision: 10,
         scale: 2,
      }).default("0"),
      appliedInterest: decimal("applied_interest", {
         precision: 10,
         scale: 2,
      }).default("0"),
      appliedPenalty: decimal("applied_penalty", {
         precision: 10,
         scale: 2,
      }).default("0"),
      autoCreateNext: boolean("auto_create_next").default(true),
      bankAccountId: uuid("bank_account_id").references(() => bankAccount.id, {
         onDelete: "set null",
      }),
      categoryId: text("category_id"),
      completionDate: timestamp("completion_date"),
      costCenterId: uuid("cost_center_id").references(() => costCenter.id, {
         onDelete: "set null",
      }),
      counterpartyId: uuid("counterparty_id"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      description: text("description").notNull(),
      dueDate: timestamp("due_date").notNull(),
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      installmentGroupId: uuid("installment_group_id"),
      installmentIntervalDays: integer("installment_interval_days"),
      installmentNumber: integer("installment_number"),
      interestTemplateId: uuid("interest_template_id"),
      isRecurring: boolean("is_recurring").default(false).notNull(),
      issueDate: timestamp("issue_date"),
      lastInterestUpdate: timestamp("last_interest_update"),
      notes: text("notes"),
      searchIndex: text("search_index"),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      originalAmount: decimal("original_amount", { precision: 10, scale: 2 }),
      parentBillId: uuid("parent_bill_id"),
      recurrencePattern: text("recurrence_pattern"),
      totalInstallments: integer("total_installments"),
      transactionId: uuid("transaction_id").references(() => transaction.id, {
         onDelete: "set null",
      }),
      type: text("type").notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [
      index("bill_organizationId_idx").on(table.organizationId),
      index("bill_searchIndex_idx").on(table.searchIndex),
   ],
);

export const billAttachment = pgTable("bill_attachment", {
   billId: uuid("bill_id")
      .notNull()
      .references(() => bill.id, { onDelete: "cascade" }),
   contentType: text("content_type").notNull(),
   createdAt: timestamp("created_at").defaultNow().notNull(),
   fileName: text("file_name").notNull(),
   fileSize: integer("file_size"),
   id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
   storageKey: text("storage_key").notNull(),
   updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
});

export const billAttachmentRelations = relations(billAttachment, ({ one }) => ({
   bill: one(bill, {
      fields: [billAttachment.billId],
      references: [bill.id],
   }),
}));

export const billRelations = relations(bill, ({ one, many }) => ({
   attachments: many(billAttachment),
   bankAccount: one(bankAccount, {
      fields: [bill.bankAccountId],
      references: [bankAccount.id],
   }),
   billTags: many(billTag),
   costCenter: one(costCenter, {
      fields: [bill.costCenterId],
      references: [costCenter.id],
   }),
   counterparty: one(counterparty, {
      fields: [bill.counterpartyId],
      references: [counterparty.id],
   }),
   interestTemplate: one(interestTemplate, {
      fields: [bill.interestTemplateId],
      references: [interestTemplate.id],
   }),
   organization: one(organization, {
      fields: [bill.organizationId],
      references: [organization.id],
   }),
   transaction: one(transaction, {
      fields: [bill.transactionId],
      references: [transaction.id],
   }),
}));
