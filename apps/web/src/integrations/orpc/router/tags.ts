import {
   archiveTag,
   bulkArchiveTags,
   bulkDeleteTags,
   createTag,
   deleteTag,
   ensureTagOwnership,
   listTags,
   updateTag,
} from "@core/database/repositories/tags-repository";
import { createTagSchema, updateTagSchema } from "@core/database/schemas/tags";
import { user as userTable } from "@core/database/schemas/auth";
import { WebAppError } from "@core/logging/errors";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { enqueueDeriveTagKeywordsWorkflow } from "@packages/workflows/workflows/derive-tag-keywords-workflow";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createTagSchema)
   .handler(async ({ context, input }) => {
      const [tagResult, userRecord] = await Promise.all([
         createTag(context.db, context.teamId, input),
         context.db.query.user.findFirst({
            where: eq(userTable.id, context.userId),
            columns: { stripeCustomerId: true },
         }),
      ]);
      const tag = tagResult.match(
         (t) => t,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      await enqueueDeriveTagKeywordsWorkflow(context.workflowClient, {
         tagId: tag.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         name: tag.name,
         description: tag.description ?? null,
         userId: context.userId,
         stripeCustomerId: userRecord?.stripeCustomerId ?? null,
      });
      return tag;
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
      const tag = (
         await ensureTagOwnership(context.db, input.id, context.teamId).andThen(
            () => updateTag(context.db, id, data),
         )
      ).match(
         (t) => t,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      if (data.name !== undefined || data.description !== undefined) {
         const userRecord = await context.db.query.user.findFirst({
            where: eq(userTable.id, context.userId),
            columns: { stripeCustomerId: true },
         });
         await enqueueDeriveTagKeywordsWorkflow(context.workflowClient, {
            tagId: tag.id,
            teamId: context.teamId,
            organizationId: context.organizationId,
            name: tag.name,
            description: tag.description ?? null,
            userId: context.userId,
            stripeCustomerId: userRecord?.stripeCustomerId ?? null,
         });
      }
      return tag;
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

export const bulkArchive = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      (await bulkArchiveTags(context.db, input.ids, context.teamId)).match(
         () => null,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      return { archived: input.ids.length };
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
