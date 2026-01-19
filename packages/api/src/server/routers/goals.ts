import {
   completeGoal,
   createGoal,
   deleteGoal,
   findGoalById,
   findGoalByTagId,
   findGoalsByOrganizationId,
   getActiveGoalsCount,
   getGoalProgressSummary,
   getGoalsNearingDeadline,
   updateGoal,
} from "@packages/database/repositories/goal-repository";
import {
   createTag,
   deleteTag,
   findTagById,
} from "@packages/database/repositories/tag-repository";
import type { GoalMetadata } from "@packages/database/schemas/goals";
import { APIError } from "@packages/utils/errors";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

// ============================================
// Validation Schemas
// ============================================

const goalMetadataSchema = z.object({
   linkedBankAccountIds: z.array(z.string().uuid()).optional(),
   linkedCategoryIds: z.array(z.string().uuid()).optional(),
   notes: z.string().max(1000).optional(),
});

const newTagSchema = z.object({
   name: z.string().min(1).max(50),
   color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

const createGoalSchema = z
   .object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      // Either provide an existing tagId or create a new tag
      tagId: z.string().uuid().optional(),
      newTag: newTagSchema.optional(),
      progressCalculationType: z
         .enum(["income", "expense", "net"])
         .default("income"),
      targetAmount: z.number().positive(),
      startingAmount: z.number().min(0).optional(),
      targetDate: z.string().datetime().optional(),
      metadata: goalMetadataSchema.optional(),
   })
   .refine((data) => data.tagId || data.newTag, {
      message: "Either tagId or newTag must be provided",
   });

const updateGoalSchema = z.object({
   id: z.string().uuid(),
   name: z.string().min(1).max(100).optional(),
   description: z.string().max(500).optional().nullable(),
   status: z.enum(["active", "paused", "cancelled"]).optional(),
   progressCalculationType: z.enum(["income", "expense", "net"]).optional(),
   targetAmount: z.number().positive().optional(),
   startingAmount: z.number().min(0).optional(),
   targetDate: z.string().datetime().optional().nullable(),
   metadata: goalMetadataSchema.optional(),
});

// ============================================
// Router
// ============================================

export const goalsRouter = router({
   create: protectedProcedure
      .input(createGoalSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;

         let tagId: string;

         // Handle tag creation or validation
         if (input.newTag) {
            // Create a new tag
            const newTag = await createTag(resolvedCtx.db, {
               id: crypto.randomUUID(),
               organizationId,
               name: input.newTag.name,
               color: input.newTag.color,
            });
            if (!newTag) {
               throw APIError.internal("Failed to create tag");
            }
            tagId = newTag.id;
         } else if (input.tagId) {
            // Validate existing tag
            const existingTag = await findTagById(resolvedCtx.db, input.tagId);
            if (!existingTag || existingTag.organizationId !== organizationId) {
               throw APIError.notFound("Tag not found");
            }

            // Check if tag already has a goal
            const existingGoal = await findGoalByTagId(
               resolvedCtx.db,
               input.tagId,
            );
            if (existingGoal) {
               throw APIError.conflict("This tag is already linked to a goal");
            }

            tagId = input.tagId;
         } else {
            throw APIError.validation(
               "Either tagId or newTag must be provided",
            );
         }

         return createGoal(resolvedCtx.db, {
            organizationId,
            createdBy: userId,
            tagId,
            name: input.name,
            description: input.description,
            progressCalculationType: input.progressCalculationType,
            targetAmount: input.targetAmount.toString(),
            startingAmount: input.startingAmount?.toString() ?? "0",
            targetDate: input.targetDate
               ? new Date(input.targetDate)
               : undefined,
            metadata: input.metadata as GoalMetadata,
         });
      }),

   update: protectedProcedure
      .input(updateGoalSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existing = await findGoalById(resolvedCtx.db, input.id);
         if (!existing || existing.organizationId !== organizationId) {
            throw APIError.notFound("Goal not found");
         }

         const updateData: Parameters<typeof updateGoal>[2] = {};

         if (input.name !== undefined) updateData.name = input.name;
         if (input.description !== undefined)
            updateData.description = input.description;
         if (input.status !== undefined) updateData.status = input.status;
         if (input.progressCalculationType !== undefined)
            updateData.progressCalculationType = input.progressCalculationType;
         if (input.targetAmount !== undefined)
            updateData.targetAmount = input.targetAmount.toString();
         if (input.startingAmount !== undefined)
            updateData.startingAmount = input.startingAmount.toString();
         if (input.targetDate !== undefined) {
            updateData.targetDate = input.targetDate
               ? new Date(input.targetDate)
               : null;
         }
         if (input.metadata !== undefined)
            updateData.metadata = input.metadata as GoalMetadata;

         return updateGoal(resolvedCtx.db, input.id, updateData);
      }),

   complete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existing = await findGoalById(resolvedCtx.db, input.id);
         if (!existing || existing.organizationId !== organizationId) {
            throw APIError.notFound("Goal not found");
         }

         return completeGoal(resolvedCtx.db, input.id);
      }),

   delete: protectedProcedure
      .input(
         z.object({
            id: z.string().uuid(),
            deleteTag: z.boolean().default(false),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existing = await findGoalById(resolvedCtx.db, input.id);
         if (!existing || existing.organizationId !== organizationId) {
            throw APIError.notFound("Goal not found");
         }

         const tagId = existing.tagId;

         // Delete the goal first
         const deleted = await deleteGoal(resolvedCtx.db, input.id);

         // Optionally delete the tag
         if (input.deleteTag && deleted) {
            await deleteTag(resolvedCtx.db, tagId);
         }

         return { deleted, tagDeleted: input.deleteTag };
      }),

   getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const goal = await findGoalById(resolvedCtx.db, input.id);
         if (!goal || goal.organizationId !== organizationId) {
            throw APIError.notFound("Goal not found");
         }

         return goal;
      }),

   getAll: protectedProcedure
      .input(
         z
            .object({
               status: z
                  .enum(["active", "completed", "paused", "cancelled"])
                  .optional(),
               limit: z.number().min(1).max(100).optional(),
               offset: z.number().min(0).optional(),
            })
            .optional(),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return findGoalsByOrganizationId(
            resolvedCtx.db,
            organizationId,
            input,
         );
      }),

   getProgress: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const goal = await findGoalById(resolvedCtx.db, input.id);
         if (!goal || goal.organizationId !== organizationId) {
            throw APIError.notFound("Goal not found");
         }

         return getGoalProgressSummary(resolvedCtx.db, input.id);
      }),

   getActiveCount: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      return getActiveGoalsCount(resolvedCtx.db, organizationId);
   }),

   getNearingDeadline: protectedProcedure
      .input(
         z
            .object({ daysAhead: z.number().min(1).max(365).optional() })
            .optional(),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return getGoalsNearingDeadline(
            resolvedCtx.db,
            organizationId,
            input?.daysAhead ?? 30,
         );
      }),
});
