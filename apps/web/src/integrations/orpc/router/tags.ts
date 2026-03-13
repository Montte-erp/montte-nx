import {
   archiveTag,
   createTag,
   deleteTag,
   ensureTagOwnership,
   listTags,
   updateTag,
} from "@core/database/repositories/tags-repository";
import { createTagSchema, updateTagSchema } from "@core/database/schemas/tags";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createTagSchema)
   .handler(async ({ context, input }) => {
      return createTag(context.db, context.teamId, input);
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   return listTags(context.db, context.teamId);
});

export const update = protectedProcedure
   .input(idSchema.merge(updateTagSchema))
   .handler(async ({ context, input }) => {
      await ensureTagOwnership(context.db, input.id, context.teamId);
      const { id, ...data } = input;
      return updateTag(context.db, id, data);
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureTagOwnership(context.db, input.id, context.teamId);
      await deleteTag(context.db, input.id);
      return { success: true };
   });

export const archive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureTagOwnership(context.db, input.id, context.teamId);
      return archiveTag(context.db, input.id);
   });
