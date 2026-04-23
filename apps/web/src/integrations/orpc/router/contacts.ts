import {
   archiveContact,
   bulkDeleteContacts,
   createContact,
   deleteContact,
   ensureContactOwnership,
   getContactTransactionStats,
   getContactTransactions,
   listContacts,
   reactivateContact,
   updateContact,
} from "@core/database/repositories/contacts-repository";
import {
   createContactSchema,
   updateContactSchema,
} from "@core/database/schemas/contacts";
import { WebAppError } from "@core/logging/errors";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createContactSchema)
   .handler(async ({ context, input }) => {
      return (await createContact(context.db, context.teamId, input)).match(
         (contact) => contact,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
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
      return (
         await listContacts(context.db, context.teamId, input?.type)
      ).match(
         (contacts) => contacts,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const getById = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      return (
         await ensureContactOwnership(context.db, input.id, context.teamId)
      ).match(
         (contact) => contact,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const getStats = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownership = await ensureContactOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownership.isErr()) throw WebAppError.fromAppError(ownership.error);
      return (
         await getContactTransactionStats(context.db, input.id, context.teamId)
      ).match(
         (stats) => stats,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const getTransactions = protectedProcedure
   .input(
      z.object({
         id: z.string().uuid(),
         page: z.number().int().min(1).default(1),
         pageSize: z.number().int().min(1).max(100).default(20),
      }),
   )
   .handler(async ({ context, input }) => {
      const ownership = await ensureContactOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownership.isErr()) throw WebAppError.fromAppError(ownership.error);
      return (
         await getContactTransactions(context.db, input.id, context.teamId, {
            page: input.page,
            limit: input.pageSize,
         })
      ).match(
         (result) => result,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateContactSchema))
   .handler(async ({ context, input }) => {
      const ownership = await ensureContactOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownership.isErr()) throw WebAppError.fromAppError(ownership.error);
      const { id, ...data } = input;
      return (await updateContact(context.db, id, data)).match(
         (contact) => contact,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownership = await ensureContactOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownership.isErr()) throw WebAppError.fromAppError(ownership.error);
      return (await deleteContact(context.db, input.id)).match(
         () => ({ success: true }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      return (
         await bulkDeleteContacts(context.db, input.ids, context.teamId)
      ).match(
         () => ({ deleted: input.ids.length }),
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const archive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownership = await ensureContactOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownership.isErr()) throw WebAppError.fromAppError(ownership.error);
      return (await archiveContact(context.db, input.id)).match(
         (contact) => contact,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const reactivate = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownership = await ensureContactOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownership.isErr()) throw WebAppError.fromAppError(ownership.error);
      return (await reactivateContact(context.db, input.id)).match(
         (contact) => contact,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });
