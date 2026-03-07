import { ORPCError } from "@orpc/server";
import {
   bankAccountHasTransactions,
   computeBankAccountBalance,
   createBankAccount,
   deleteBankAccount,
   getBankAccount,
   listBankAccountsWithBalance,
   updateBankAccount,
} from "@packages/database/repositories/bank-accounts-repository";
import { bankAccounts } from "@packages/database/schemas/bank-accounts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const bankAccountSchema = createInsertSchema(bankAccounts)
   .pick({
      name: true,
      type: true,
      color: true,
      iconUrl: true,
      initialBalance: true,
      bankCode: true,
      bankName: true,
      nickname: true,
      branch: true,
      accountNumber: true,
      initialBalanceDate: true,
      notes: true,
   })
   .extend({
      color: z
         .string()
         .refine((v) => /^#[0-9a-fA-F]{6}$/.test(v), {
            message: "Cor inválida. Use formato hex (#RRGGBB).",
         })
         .optional(),
      initialBalance: z
         .string()
         .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
            message: "Saldo inicial inválido.",
         })
         .optional(),
      initialBalanceDate: z.coerce.date().optional().nullable(),
   });

// =============================================================================
// Bank Account Procedures
// =============================================================================

export const create = protectedProcedure
   .input(bankAccountSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return createBankAccount(db, { ...input, teamId });
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return listBankAccountsWithBalance(db, teamId);
});

export const getById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const account = await getBankAccount(db, input.id);
      if (!account || account.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Conta bancária não encontrada.",
         });
      }
      const currentBalance = await computeBankAccountBalance(
         db,
         account.id,
         account.initialBalance,
      );
      return { ...account, currentBalance };
   });

export const update = protectedProcedure
   .input(
      z.object({ id: z.string().uuid() }).merge(bankAccountSchema.partial()),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const account = await getBankAccount(db, input.id);
      if (!account || account.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Conta bancária não encontrada.",
         });
      }
      const { id, ...data } = input;
      return updateBankAccount(db, id, data);
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const account = await getBankAccount(db, input.id);
      if (!account || account.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Conta bancária não encontrada.",
         });
      }
      const hasTransactions = await bankAccountHasTransactions(db, input.id);
      if (hasTransactions) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Não é possível excluir uma conta com transações.",
         });
      }
      await deleteBankAccount(db, input.id);
      return { success: true };
   });
