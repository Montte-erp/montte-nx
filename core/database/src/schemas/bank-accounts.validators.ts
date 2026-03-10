import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { bankAccounts } from "./bank-accounts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANK_TYPES = ["checking", "savings", "investment", "payment"] as const;

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// Base schema from Drizzle — user-provided fields only
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Create schema
// ---------------------------------------------------------------------------

export const createBankAccountSchema = baseBankAccountSchema
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(80, "Nome deve ter no máximo 80 caracteres."),
      color: z
         .string()
         .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).")
         .default("#6366f1"),
      initialBalance: z
         .string()
         .refine((v) => !Number.isNaN(Number(v)), {
            message: "Saldo inicial deve ser um número válido.",
         })
         .default("0"),
      initialBalanceDate: z.coerce.date().optional().nullable(),
      bankCode: z.string().max(10).optional().nullable(),
      bankName: z.string().max(120).optional().nullable(),
      branch: z.string().max(20).optional().nullable(),
      accountNumber: z.string().max(30).optional().nullable(),
   })
   .superRefine((data, ctx) => {
      const isCash = data.type === "cash";
      const isBankType = BANK_TYPES.includes(
         data.type as (typeof BANK_TYPES)[number],
      );

      if (isCash) {
         if (data.bankCode) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["bankCode"],
               message: "Caixa físico não deve ter código do banco.",
            });
         }
         if (data.branch) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["branch"],
               message: "Caixa físico não deve ter agência.",
            });
         }
         if (data.accountNumber) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["accountNumber"],
               message: "Caixa físico não deve ter número da conta.",
            });
         }
      }

      if (isBankType && !data.bankCode) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bankCode"],
            message: "Código do banco é obrigatório para contas bancárias.",
         });
      }
   });

// ---------------------------------------------------------------------------
// Update schema — all fields optional
// ---------------------------------------------------------------------------

export const updateBankAccountSchema = baseBankAccountSchema
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(80, "Nome deve ter no máximo 80 caracteres.")
         .optional(),
      color: z
         .string()
         .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).")
         .optional(),
      initialBalance: z
         .string()
         .refine((v) => !Number.isNaN(Number(v)), {
            message: "Saldo inicial deve ser um número válido.",
         })
         .optional(),
      initialBalanceDate: z.coerce.date().optional().nullable(),
      bankCode: z.string().max(10).optional().nullable(),
      bankName: z.string().max(120).optional().nullable(),
      branch: z.string().max(20).optional().nullable(),
      accountNumber: z.string().max(30).optional().nullable(),
   })
   .partial();

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
