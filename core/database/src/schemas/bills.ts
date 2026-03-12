import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-orm/zod";
import {
   date,
   index,
   integer,
   numeric,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { transactions } from "@core/database/schemas/transactions";
import { z } from "zod";

export const billTypeEnum = pgEnum("bill_type", ["payable", "receivable"]);

export const billStatusEnum = pgEnum("bill_status", [
   "pending",
   "paid",
   "cancelled",
]);

export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
   "daily",
   "weekly",
   "biweekly",
   "monthly",
   "quarterly",
   "yearly",
]);

export const recurrenceSettings = pgTable(
   "recurrence_settings",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      frequency: recurrenceFrequencyEnum("frequency").notNull(),
      windowMonths: integer("window_months").notNull().default(3),
      endsAt: date("ends_at"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [index("recurrence_settings_team_id_idx").on(table.teamId)],
);

export const bills = pgTable(
   "bills",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      type: billTypeEnum("type").notNull(),
      status: billStatusEnum("status").notNull().default("pending"),
      amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
      dueDate: date("due_date").notNull(),
      paidAt: timestamp("paid_at", { withTimezone: true }),
      // set null: bills are forward-looking records; deleting the account de-links it but does not block deletion
      bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
         onDelete: "set null",
      }),
      categoryId: uuid("category_id").references(() => categories.id, {
         onDelete: "set null",
      }),
      attachmentUrl: text("attachment_url"),
      // Self-referential grouping key (not an FK) — the first installment's id is used as group id for all siblings
      installmentGroupId: uuid("installment_group_id"),
      installmentIndex: integer("installment_index"),
      installmentTotal: integer("installment_total"),
      recurrenceGroupId: uuid("recurrence_group_id").references(
         () => recurrenceSettings.id,
         { onDelete: "cascade" },
      ),
      transactionId: uuid("transaction_id").references(() => transactions.id, {
         onDelete: "set null",
      }),
      contactId: uuid("contact_id").references(() => contacts.id, {
         onDelete: "restrict",
      }),
      subscriptionId: uuid("subscription_id"), // nullable — set when bill is auto-generated from a subscription
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("bills_team_id_idx").on(table.teamId),
      index("bills_due_date_idx").on(table.dueDate),
      index("bills_status_idx").on(table.status),
      index("bills_installment_group_idx").on(table.installmentGroupId),
      index("bills_recurrence_group_idx").on(table.recurrenceGroupId),
      index("bills_transaction_id_idx").on(table.transactionId),
      index("bills_type_idx").on(table.type),
      index("bills_contact_id_idx").on(table.contactId),
      index("bills_subscription_id_idx").on(table.subscriptionId),
   ],
);

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillType = (typeof billTypeEnum.enumValues)[number];
export type BillStatus = (typeof billStatusEnum.enumValues)[number];
export type RecurrenceFrequency =
   (typeof recurrenceFrequencyEnum.enumValues)[number];
export type RecurrenceSetting = typeof recurrenceSettings.$inferSelect;
export type NewRecurrenceSetting = typeof recurrenceSettings.$inferInsert;

const numericPositive = (msg: string) =>
   z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: msg,
   });

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

const baseBillSchema = createInsertSchema(bills).pick({
   name: true,
   description: true,
   type: true,
   amount: true,
   dueDate: true,
   bankAccountId: true,
   categoryId: true,
   contactId: true,
   attachmentUrl: true,
});

export const createBillSchema = baseBillSchema.extend({
   name: z
      .string()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(200, "Nome deve ter no máximo 200 caracteres."),
   description: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   type: z.enum(["payable", "receivable"], {
      message: "Tipo é obrigatório.",
   }),
   amount: numericPositive("Valor deve ser um número válido maior que zero."),
   dueDate: dateSchema,
   bankAccountId: z.string().uuid().nullable().optional(),
   categoryId: z.string().uuid().nullable().optional(),
   contactId: z.string().uuid().nullable().optional(),
   attachmentUrl: z.string().nullable().optional(),
});

export const updateBillSchema = createBillSchema
   .extend({
      status: z.enum(["pending", "paid", "cancelled"]).optional(),
      paidAt: z.date().nullable().optional(),
      transactionId: z.string().uuid().nullable().optional(),
   })
   .partial();

const baseRecurrenceSchema = createInsertSchema(recurrenceSettings).pick({
   frequency: true,
   windowMonths: true,
   endsAt: true,
});

export const createRecurrenceSettingSchema = baseRecurrenceSchema.extend({
   frequency: z.enum(
      ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"],
      { message: "Frequência é obrigatória." },
   ),
   windowMonths: z
      .number()
      .int()
      .min(1, "Janela deve ser de no mínimo 1 mês.")
      .default(3),
   endsAt: dateSchema.nullable().optional(),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type CreateRecurrenceSettingInput = z.infer<
   typeof createRecurrenceSettingSchema
>;
