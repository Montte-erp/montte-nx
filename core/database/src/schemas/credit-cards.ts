import { sql } from "drizzle-orm";
import {
   index,
   integer,
   numeric,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { financeSchema } from "@core/database/schemas/schemas";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { bankAccounts } from "@core/database/schemas/bank-accounts";

export const creditCardStatusEnum = financeSchema.enum("credit_card_status", [
   "active",
   "blocked",
   "cancelled",
]);

export const creditCardBrandEnum = financeSchema.enum("credit_card_brand", [
   "visa",
   "mastercard",
   "elo",
   "amex",
   "hipercard",
   "other",
]);

export const creditCards = financeSchema.table(
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
      bankAccountId: uuid("bank_account_id")
         .notNull()
         .references(() => bankAccounts.id, { onDelete: "restrict" }),
      status: creditCardStatusEnum("status").notNull().default("active"),
      brand: creditCardBrandEnum("brand"),
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
export type CreditCardStatus = (typeof creditCardStatusEnum.enumValues)[number];
export type CreditCardBrand = (typeof creditCardBrandEnum.enumValues)[number];

// =============================================================================
// Validators
// =============================================================================

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(80, "Nome deve ter no máximo 80 caracteres.");

const creditLimitSchema = z.string().refine(
   (v) => {
      const n = Number(v);
      return !Number.isNaN(n) && n >= 0;
   },
   { message: "Limite deve ser um número válido e não negativo." },
);

const colorSchema = z
   .string()
   .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).");

const daySchema = z
   .number()
   .int("Dia deve ser um número inteiro.")
   .min(1, "Dia deve ser entre 1 e 31.")
   .max(31, "Dia deve ser entre 1 e 31.");

const baseCreditCardSchema = createInsertSchema(creditCards).pick({
   name: true,
   color: true,
   iconUrl: true,
   creditLimit: true,
   closingDay: true,
   dueDay: true,
   bankAccountId: true,
   brand: true,
});

export const createCreditCardSchema = baseCreditCardSchema.extend({
   name: nameSchema,
   color: colorSchema.default("#6366f1"),
   creditLimit: creditLimitSchema.default("0"),
   closingDay: daySchema,
   dueDay: daySchema,
   bankAccountId: z.string().uuid("Conta vinculada inválida."),
   brand: z
      .enum(["visa", "mastercard", "elo", "amex", "hipercard", "other"])
      .nullable()
      .optional(),
});

export const updateCreditCardSchema = baseCreditCardSchema
   .extend({
      name: nameSchema.optional(),
      color: colorSchema.optional(),
      creditLimit: creditLimitSchema.optional(),
      closingDay: daySchema.optional(),
      dueDay: daySchema.optional(),
      bankAccountId: z.string().uuid("Conta vinculada inválida.").optional(),
      brand: z
         .enum(["visa", "mastercard", "elo", "amex", "hipercard", "other"])
         .nullable()
         .optional(),
   })
   .partial();

export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type UpdateCreditCardInput = z.infer<typeof updateCreditCardSchema>;
