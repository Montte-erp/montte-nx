import {
   createTag,
   deleteManyTags,
   deleteTag,
   findTagById,
   findTagsByOrganizationId,
   findTagsByOrganizationIdPaginated,
   findTagsWithoutGoal,
   findTransactionsByTagId,
   getTagWithMostTransactions,
   getTotalTagsByOrganizationId,
   updateTag,
} from "@packages/database/repositories/tag-repository";
import { APIError } from "@packages/utils/errors";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const createTagSchema = z.object({
   color: z.string(),
   icon: z.string().optional(),
   name: z.string(),
});

const updateTagSchema = z.object({
   color: z.string().optional(),
   icon: z.string().optional(),
   name: z.string().optional(),
});

const paginationSchema = z.object({
   limit: z.coerce.number().min(1).max(100).default(10),
   orderBy: z.enum(["name", "createdAt", "updatedAt"]).default("name"),
   orderDirection: z.enum(["asc", "desc"]).default("asc"),
   page: z.coerce.number().min(1).default(1),
   search: z.string().optional(),
});

export const tagRouter = router({
   create: protectedProcedure
      .input(createTagSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return createTag(resolvedCtx.db, {
            ...input,
            id: crypto.randomUUID(),
            organizationId,
         });
      }),

   delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingTag = await findTagById(resolvedCtx.db, input.id);

         if (!existingTag || existingTag.organizationId !== organizationId) {
            throw APIError.notFound("Tag not found");
         }

         return deleteTag(resolvedCtx.db, input.id);
      }),

   deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return deleteManyTags(resolvedCtx.db, input.ids, organizationId);
      }),

   getAll: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      return findTagsByOrganizationId(resolvedCtx.db, organizationId);
   }),

   getAllPaginated: protectedProcedure
      .input(paginationSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return findTagsByOrganizationIdPaginated(
            resolvedCtx.db,
            organizationId,
            {
               limit: input.limit,
               orderBy: input.orderBy,
               orderDirection: input.orderDirection,
               page: input.page,
               search: input.search,
            },
         );
      }),

   getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const tag = await findTagById(resolvedCtx.db, input.id);

         if (!tag || tag.organizationId !== organizationId) {
            throw APIError.notFound("Tag not found");
         }

         return tag;
      }),

   getAvailableForGoal: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      return findTagsWithoutGoal(resolvedCtx.db, organizationId);
   }),

   getStats: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      const [totalTags, tagWithMostTransactions] = await Promise.all([
         getTotalTagsByOrganizationId(resolvedCtx.db, organizationId),
         getTagWithMostTransactions(resolvedCtx.db, organizationId),
      ]);

      return {
         tagWithMostTransactions: tagWithMostTransactions?.tagName || null,
         totalTags,
      };
   }),

   getTransactions: protectedProcedure
      .input(
         z.object({
            id: z.string(),
            limit: z.coerce.number().min(1).max(100).default(10),
            page: z.coerce.number().min(1).default(1),
         }),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const tag = await findTagById(resolvedCtx.db, input.id);

         if (!tag || tag.organizationId !== organizationId) {
            throw APIError.notFound("Tag not found");
         }

         return findTransactionsByTagId(resolvedCtx.db, input.id, {
            limit: input.limit,
            page: input.page,
         });
      }),

   update: protectedProcedure
      .input(
         z.object({
            data: updateTagSchema,
            id: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingTag = await findTagById(resolvedCtx.db, input.id);

         if (!existingTag || existingTag.organizationId !== organizationId) {
            throw APIError.notFound("Tag not found");
         }

         return updateTag(resolvedCtx.db, input.id, input.data);
      }),
});
