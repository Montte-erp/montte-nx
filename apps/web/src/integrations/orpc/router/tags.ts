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
import { WebAppError } from "@core/logging";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createTagSchema)
   .handler(async ({ context, input }) => {
      return (await createTag(context.db, context.teamId, input)).match(
         (tag) => tag,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   return (await listTags(context.db, context.teamId)).match(
      (tags) => tags,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   );
});

export const update = protectedProcedure
   .input(idSchema.merge(updateTagSchema))
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return (
         await ensureTagOwnership(context.db, input.id, context.teamId).andThen(
            () => updateTag(context.db, id, data),
         )
      ).match(
         (tag) => tag,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      (
         await ensureTagOwnership(context.db, input.id, context.teamId).andThen(
            () => deleteTag(context.db, input.id),
         )
      ).match(
         () => null,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      return { success: true };
   });

export const archive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      return (
         await ensureTagOwnership(context.db, input.id, context.teamId).andThen(
            () => archiveTag(context.db, input.id),
         )
      ).match(
         (tag) => tag,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      (await bulkDeleteTags(context.db, input.ids, context.teamId)).match(
         () => null,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      return { deleted: input.ids.length };
   });
