import {
   archiveTag,
   createTag,
   deleteTag,
   ensureTagOwnership,
   listTags,
   updateTag,
} from "@core/database/repositories/tags-repository";
import { ORPCError } from "@orpc/server";
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

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const results = await Promise.allSettled(
         input.ids.map(async (id) => {
            await ensureTagOwnership(context.db, id, context.teamId);
            await deleteTag(context.db, id);
         }),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: `${failed} centro(s) de custo não puderam ser excluídos.`,
         });
      }
      return { deleted: input.ids.length };
   });
