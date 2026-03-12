import {
   createContact,
   deleteContact,
   ensureContactOwnership,
   listContacts,
   updateContact,
} from "@core/database/repositories/contacts-repository";
import {
   createContactSchema,
   updateContactSchema,
} from "@core/database/schemas/contacts";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createContactSchema)
   .handler(async ({ context, input }) => {
      return createContact(context.teamId, input);
   });

export const getAll = protectedProcedure
   .input(
      z
         .object({
            type: z.enum(["cliente", "fornecedor", "ambos"]).optional(),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      return listContacts(context.teamId, input?.type);
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateContactSchema))
   .handler(async ({ context, input }) => {
      await ensureContactOwnership(input.id, context.teamId);
      const { id, ...data } = input;
      return updateContact(id, data);
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureContactOwnership(input.id, context.teamId);
      await deleteContact(input.id);
      return { success: true };
   });
