import {
   bulkCreateCreditCards,
   bulkDeleteCreditCards,
   createCreditCard,
   deleteCreditCard,
   ensureCreditCardOwnership,
   getCreditCardsSummary,
   listCreditCards,
   updateCreditCard,
} from "@core/database/repositories/credit-cards-repository";
import {
   createCreditCardSchema,
   updateCreditCardSchema,
} from "@core/database/schemas/credit-cards";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

const listCreditCardsSchema = z.object({
   page: z.number().int().positive().catch(1).default(1),
   pageSize: z.number().int().positive().max(100).catch(20).default(20),
   search: z.string().max(100).optional(),
   status: z.enum(["active", "blocked", "cancelled"]).optional(),
});

export const create = protectedProcedure
   .input(createCreditCardSchema)
   .handler(async ({ context, input }) => {
      return createCreditCard(context.db, context.teamId, input);
   });

export const getAll = protectedProcedure
   .input(listCreditCardsSchema)
   .handler(async ({ context, input }) => {
      return listCreditCards(context.db, context.teamId, input);
   });

export const getSummary = protectedProcedure.handler(async ({ context }) => {
   return getCreditCardsSummary(context.db, context.teamId);
});

export const getById = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      return ensureCreditCardOwnership(context.db, input.id, context.teamId);
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateCreditCardSchema))
   .handler(async ({ context, input }) => {
      await ensureCreditCardOwnership(context.db, input.id, context.teamId);
      const { id, ...data } = input;
      return updateCreditCard(context.db, id, data);
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureCreditCardOwnership(context.db, input.id, context.teamId);
      await deleteCreditCard(context.db, input.id);
      return { success: true };
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      await bulkDeleteCreditCards(context.db, input.ids, context.teamId);
      return { deleted: input.ids.length };
   });

const bulkCreateSchema = z.object({
   cards: z
      .array(
         z.object({
            name: z.string().min(2).max(80),
            creditLimit: z.string(),
            closingDay: z.number().int().min(1).max(31),
            dueDay: z.number().int().min(1).max(31),
            bankAccountId: z.string().uuid(),
            status: z.enum(["active", "blocked", "cancelled"]).optional(),
            brand: z
               .enum([
                  "visa",
                  "mastercard",
                  "elo",
                  "amex",
                  "hipercard",
                  "other",
               ])
               .optional(),
            color: z.string().optional(),
         }),
      )
      .min(1)
      .max(500),
});

export const bulkCreate = protectedProcedure
   .input(bulkCreateSchema)
   .handler(async ({ context, input }) => {
      return bulkCreateCreditCards(context.db, context.teamId, input.cards);
   });
