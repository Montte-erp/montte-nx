import { ORPCError } from "@orpc/server";
import {
   createCreditCard,
   deleteCreditCard,
   getCreditCard,
   listCreditCards,
   updateCreditCard,
} from "@core/database/repositories/credit-cards-repository";
import { creditCards } from "@core/database/schemas/credit-cards";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const creditCardSchema = createInsertSchema(creditCards)
   .pick({
      name: true,
      color: true,
      iconUrl: true,
      creditLimit: true,
      closingDay: true,
      dueDay: true,
      bankAccountId: true,
   })
   .extend({
      color: z
         .string()
         .refine((v) => /^#[0-9a-fA-F]{6}$/.test(v), {
            message: "Cor inválida. Use formato hex (#RRGGBB).",
         })
         .optional(),
      creditLimit: z
         .string()
         .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
            message: "Limite de crédito inválido.",
         })
         .optional(),
      closingDay: z
         .number()
         .int()
         .min(1, "Dia inválido.")
         .max(31, "Dia inválido."),
      dueDay: z.number().int().min(1, "Dia inválido.").max(31, "Dia inválido."),
      bankAccountId: z.string().uuid().nullable().optional(),
   });

export const create = protectedProcedure
   .input(creditCardSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return createCreditCard(db, { ...input, teamId });
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return listCreditCards(db, teamId);
});

export const getById = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const card = await getCreditCard(db, input.id);
      if (!card || card.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Cartão de crédito não encontrado.",
         });
      }
      return card;
   });

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(creditCardSchema.partial()))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const card = await getCreditCard(db, input.id);
      if (!card || card.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Cartão de crédito não encontrado.",
         });
      }
      const { id, ...data } = input;
      return updateCreditCard(db, id, data);
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const card = await getCreditCard(db, input.id);
      if (!card || card.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Cartão de crédito não encontrado.",
         });
      }
      await deleteCreditCard(db, input.id);
      return { success: true };
   });
