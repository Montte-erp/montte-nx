import { WebAppError } from "@core/logging/errors";
import { z } from "zod";
import { protectedProcedure } from "../server";
import {
   createRecurringTransaction,
   getRecurringTransactionsByTeam,
   deleteRecurringTransaction,
} from "@core/database/repositories/recurring-transactions-repository";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const create = protectedProcedure
   .input(
      z.object({
         teamId: z.string().uuid(),
         name: z
            .string()
            .min(2, "Nome deve ter no mínimo 2 caracteres.")
            .max(200, "Nome deve ter no máximo 200 caracteres.")
            .nullable()
            .optional(),
         type: z.enum(["income", "expense", "transfer"]),
         amount: z
            .string()
            .refine(
               (v) => !Number.isNaN(Number(v)) && Number(v) > 0,
               "Valor deve ser um número válido maior que zero.",
            ),
         description: z.string().max(500).nullable().optional(),
         bankAccountId: z.string().uuid().nullable().optional(),
         destinationBankAccountId: z.string().uuid().nullable().optional(),
         creditCardId: z.string().uuid().nullable().optional(),
         categoryId: z.string().uuid().nullable().optional(),
         contactId: z.string().uuid().nullable().optional(),
         paymentMethod: z
            .enum([
               "pix",
               "credit_card",
               "debit_card",
               "boleto",
               "cash",
               "transfer",
               "other",
               "cheque",
               "automatic_debit",
            ])
            .nullable()
            .optional(),
         frequency: z.enum(["daily", "weekly", "monthly"]),
         startDate: z
            .string()
            .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD."),
         endsAt: z.string().regex(ISO_DATE_REGEX).nullable().optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      return createRecurringTransaction(context.db, input);
   });

export const getAll = protectedProcedure
   .input(z.object({ teamId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      return getRecurringTransactionsByTeam(context.db, input.teamId);
   });

export const remove = protectedProcedure
   .input(
      z.object({
         id: z.string().uuid(),
         teamId: z.string().uuid(),
      }),
   )
   .handler(async ({ context, input }) => {
      const result = await deleteRecurringTransaction(
         context.db,
         input.id,
         input.teamId,
      );
      if (!result)
         throw WebAppError.notFound("Regra de recorrência não encontrada.");
      return result;
   });
