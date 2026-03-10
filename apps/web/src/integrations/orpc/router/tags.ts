import { ORPCError } from "@orpc/server";
import {
   createTag,
   deleteTag,
   getTag,
   listTags,
   tagHasTransactions,
   updateTag,
} from "@core/database/repositories/tags-repository";
import { tags } from "@core/database/schemas/tags";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const tagSchema = createInsertSchema(tags)
   .pick({ name: true, color: true })
   .extend({
      color: z
         .string()
         .refine((v) => /^#[0-9a-fA-F]{6}$/.test(v), {
            message: "Cor inválida. Use formato hex (#RRGGBB).",
         })
         .optional(),
   });

// =============================================================================
// Tag Procedures
// =============================================================================

export const create = protectedProcedure
   .input(tagSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return createTag(db, { ...input, teamId });
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return listTags(db, teamId);
});

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(tagSchema.partial()))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const tag = await getTag(db, input.id);
      if (!tag || tag.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Tag não encontrada." });
      }
      const { id, ...data } = input;
      return updateTag(db, id, data);
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const tag = await getTag(db, input.id);
      if (!tag || tag.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Tag não encontrada." });
      }
      const hasTransactions = await tagHasTransactions(db, input.id);
      if (hasTransactions) {
         throw new ORPCError("BAD_REQUEST", {
            message:
               "Não é possível excluir uma tag com transações vinculadas. Arquive-a em vez disso.",
         });
      }
      await deleteTag(db, input.id);
      return { success: true };
   });

export const archive = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const tag = await getTag(db, input.id);
      if (!tag || tag.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", { message: "Tag não encontrada." });
      }
      return updateTag(db, input.id, { isArchived: true });
   });
