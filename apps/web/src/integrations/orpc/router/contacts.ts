import { ORPCError } from "@orpc/server";
import {
   createContact,
   deleteContact,
   getContact,
   listContacts,
   updateContact,
} from "@core/database/repositories/contacts-repository";
import { contacts } from "@core/database/schemas/contacts";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const contactSchema = createInsertSchema(contacts).pick({
   name: true,
   type: true,
   email: true,
   phone: true,
   document: true,
   documentType: true,
   notes: true,
});

export const create = protectedProcedure
   .input(contactSchema)
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      return createContact(teamId, input);
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
      const { teamId } = context;
      return listContacts(teamId, input?.type);
   });

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(contactSchema.partial()))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const contact = await getContact(input.id);
      if (!contact || contact.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Contato não encontrado.",
         });
      }
      const { id, ...data } = input;
      return updateContact(id, data);
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const contact = await getContact(input.id);
      if (!contact || contact.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Contato não encontrado.",
         });
      }
      await deleteContact(input.id);
      return { success: true };
   });
