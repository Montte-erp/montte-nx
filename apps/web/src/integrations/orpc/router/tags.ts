import {
   archiveTag,
   bulkDeleteTags,
   createTag,
   deleteTag,
   ensureTagOwnership,
   listTags,
   updateTag,
} from "@core/database/repositories/tags-repository";
import { createTagSchema, updateTagSchema } from "@core/database/schemas/tags";
import { WebAppError } from "@core/logging/errors";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createTagSchema)
   .handler(async ({ context, input }) => {
      const result = await createTag(context.db, context.teamId, input);
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      return result.value;
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   const result = await listTags(context.db, context.teamId);
   if (result.isErr()) throw WebAppError.fromAppError(result.error);
   return result.value;
});

export const update = protectedProcedure
   .input(idSchema.merge(updateTagSchema))
   .handler(async ({ context, input }) => {
      const ownershipResult = await ensureTagOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);
      const { id, ...data } = input;
      const result = await updateTag(context.db, id, data);
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      return result.value;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownershipResult = await ensureTagOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);
      const result = await deleteTag(context.db, input.id);
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      return { success: true };
   });

export const archive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownershipResult = await ensureTagOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);
      const result = await archiveTag(context.db, input.id);
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      return result.value;
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const result = await bulkDeleteTags(
         context.db,
         input.ids,
         context.teamId,
      );
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      return { deleted: input.ids.length };
   });
