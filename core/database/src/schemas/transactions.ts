import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
   boolean,
   date,
   index,
   integer,
   jsonb,
   numeric,
   primaryKey,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { financeSchema } from "@core/database/schemas/schemas";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { creditCards } from "@core/database/schemas/credit-cards";
import { services } from "@core/database/schemas/services";
import { tags } from "@core/database/schemas/tags";
import { z } from "zod";

export const attachmentSchema = z.object({
   url: z.string().url(),
   filename: z.string().min(1),
   size: z.number().int().positive(),
   mimeType: z.string().optional(),
});

export type Attachment = z.infer<typeof attachmentSchema>;

export const paymentMethodEnum = financeSchema.enum("payment_method", [
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

export const transactionTypeEnum = financeSchema.enum("transaction_type", [
   "income",
   "expense",
   "transfer",
]);

export const transactions = financeSchema.table(
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
      suggestedCategoryId: uuid("suggested_category_id").references(
         () => categories.id,
         { onDelete: "set null" },
      ),
      attachments: jsonb("attachments").$type<Attachment[]>(),
      paymentMethod: paymentMethodEnum("payment_method"),
      isInstallment: boolean("is_installment").default(false).notNull(),
      installmentCount: integer("installment_count"),
      installmentNumber: integer("installment_number"),
      installmentGroupId: uuid("installment_group_id"),
      statementPeriod: text("statement_period"),
      contactId: uuid("contact_id").references(() => contacts.id, {
         onDelete: "restrict",
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
      index("transactions_suggested_category_id_idx").on(
         table.suggestedCategoryId,
      ),
      index("transactions_statement_period_idx").on(
         table.creditCardId,
         table.statementPeriod,
      ),
   ],
);

export const transactionTags = financeSchema.table(
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

export const transactionItems = financeSchema.table("transaction_items", {
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

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type TransactionTag = typeof transactionTags.$inferSelect;
export type NewTransactionTag = typeof transactionTags.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type NewTransactionItem = typeof transactionItems.$inferInsert;

const numericPositive = (msg: string) =>
   z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: msg,
   });

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

const baseTransactionSchema = createInsertSchema(transactions).pick({
   type: true,
   amount: true,
   description: true,
   date: true,
   bankAccountId: true,
   destinationBankAccountId: true,
   categoryId: true,
   creditCardId: true,
   contactId: true,
   paymentMethod: true,
   attachments: true,
   isInstallment: true,
   installmentCount: true,
   installmentNumber: true,
   installmentGroupId: true,
   statementPeriod: true,
});

export const createTransactionSchema = baseTransactionSchema
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(200, "Nome deve ter no máximo 200 caracteres.")
         .nullable()
         .optional(),
      type: z.enum(["income", "expense", "transfer"], {
         message: "Tipo de lançamento é obrigatório.",
      }),
      amount: numericPositive(
         "Valor deve ser um número válido maior que zero.",
      ),
      date: dateSchema,
      description: z
         .string()
         .max(500, "Descrição deve ter no máximo 500 caracteres.")
         .nullable()
         .optional(),
      bankAccountId: z.string().uuid().nullable().optional(),
      destinationBankAccountId: z.string().uuid().nullable().optional(),
      creditCardId: z.string().uuid().nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      contactId: z.string().uuid().nullable().optional(),
      attachments: z.array(attachmentSchema).nullable().optional(),
   })
   .superRefine((data, ctx) => {
      if (data.type === "transfer") {
         if (!data.bankAccountId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: "Transferências exigem uma conta de origem.",
               path: ["bankAccountId"],
            });
         }
         if (!data.destinationBankAccountId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: "Transferências exigem uma conta de destino.",
               path: ["destinationBankAccountId"],
            });
         }
         if (
            data.bankAccountId &&
            data.destinationBankAccountId &&
            data.bankAccountId === data.destinationBankAccountId
         ) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: "Conta de origem e destino devem ser diferentes.",
               path: ["destinationBankAccountId"],
            });
         }
      }
      if (data.type === "expense") {
         if (!data.bankAccountId && !data.creditCardId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message:
                  "Despesas exigem uma conta bancária ou cartão de crédito.",
               path: ["bankAccountId"],
            });
         }
      }
      if (data.type === "income") {
         if (!data.bankAccountId) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: "Receitas exigem uma conta bancária.",
               path: ["bankAccountId"],
            });
         }
      }
   });

export const updateTransactionSchema = baseTransactionSchema
   .omit({ type: true })
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(200, "Nome deve ter no máximo 200 caracteres.")
         .nullable()
         .optional(),
      amount: numericPositive(
         "Valor deve ser um número válido maior que zero.",
      ).optional(),
      date: dateSchema.optional(),
      description: z
         .string()
         .max(500, "Descrição deve ter no máximo 500 caracteres.")
         .nullable()
         .optional(),
      bankAccountId: z.string().uuid().nullable().optional(),
      destinationBankAccountId: z.string().uuid().nullable().optional(),
      creditCardId: z.string().uuid().nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      contactId: z.string().uuid().nullable().optional(),
      attachments: z.array(attachmentSchema).nullable().optional(),
   })
   .partial();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
