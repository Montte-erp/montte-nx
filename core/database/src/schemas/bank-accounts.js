import { sql } from "drizzle-orm";
import {
   date,
   index,
   numeric,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { financeSchema } from "@core/database/schemas/schemas";
export const bankAccountTypeEnum = financeSchema.enum("bank_account_type", [
   "checking",
   "savings",
   "investment",
   "payment",
   "cash",
]);
export const bankAccountStatusEnum = financeSchema.enum("bank_account_status", [
   "active",
   "archived",
]);
export const bankAccounts = financeSchema.table(
   "bank_accounts",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: bankAccountTypeEnum("type").notNull().default("checking"),
      status: bankAccountStatusEnum("status").notNull().default("active"),
      color: text("color").notNull().default("#6366f1"),
      iconUrl: text("icon_url"),
      bankCode: text("bank_code"),
      bankName: text("bank_name"),
      branch: text("branch"),
      accountNumber: text("account_number"),
      initialBalance: numeric("initial_balance", { precision: 12, scale: 2 })
         .notNull()
         .default("0"),
      initialBalanceDate: date("initial_balance_date"),
      notes: text("notes"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("bank_accounts_team_id_idx").on(table.teamId),
      index("bank_accounts_status_idx").on(table.status),
   ],
);
// =============================================================================
// Validators
// =============================================================================
const BANK_TYPES = ["checking", "savings", "investment", "payment"];
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(80, "Nome deve ter no máximo 80 caracteres.");
const colorSchema = z
   .string()
   .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).");
const balanceSchema = z.string().refine((v) => !Number.isNaN(Number(v)), {
   message: "Saldo inicial deve ser um número válido.",
});
const dateStringSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.")
   .nullable()
   .optional();
const bankDetailFields = {
   bankCode: z.string().max(10).nullable().optional(),
   bankName: z.string().max(120).nullable().optional(),
   branch: z.string().max(20).nullable().optional(),
   accountNumber: z.string().max(30).nullable().optional(),
};
const baseBankAccountSchema = createInsertSchema(bankAccounts).pick({
   name: true,
   type: true,
   color: true,
   iconUrl: true,
   bankCode: true,
   bankName: true,
   branch: true,
   accountNumber: true,
   initialBalance: true,
   initialBalanceDate: true,
   notes: true,
});
function refineBankAccountType(data, ctx) {
   if (!data.type) return;
   const isCash = data.type === "cash";
   const isBankType = BANK_TYPES.includes(data.type);
   if (isCash) {
      for (const [field, msg] of [
         ["bankCode", "código do banco"],
         ["branch", "agência"],
         ["accountNumber", "número da conta"],
      ]) {
         if (data[field]) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: [field],
               message: `Caixa físico não deve ter ${msg}.`,
            });
         }
      }
   }
   if (isBankType && !data.bankCode) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["bankCode"],
         message: "Código do banco é obrigatório para contas bancárias.",
      });
   }
}
export const createBankAccountSchema = baseBankAccountSchema
   .extend({
      name: nameSchema,
      color: colorSchema.default("#6366f1"),
      initialBalance: balanceSchema.default("0"),
      initialBalanceDate: dateStringSchema,
      ...bankDetailFields,
   })
   .superRefine(refineBankAccountType);
export const updateBankAccountSchema = baseBankAccountSchema
   .extend({
      name: nameSchema.optional(),
      color: colorSchema.optional(),
      initialBalance: balanceSchema.optional(),
      initialBalanceDate: dateStringSchema,
      ...bankDetailFields,
   })
   .partial();
