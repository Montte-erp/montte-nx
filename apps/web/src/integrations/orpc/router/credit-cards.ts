import {
   bulkDeleteCreditCards,
   createCreditCard,
   deleteCreditCard,
   ensureCreditCardOwnership,
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

export const create = protectedProcedure
   .input(createCreditCardSchema)
   .handler(async ({ context, input }) => {
      return createCreditCard(context.db, context.teamId, input);
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   return listCreditCards(context.db, context.teamId);
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
