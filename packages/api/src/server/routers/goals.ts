import {
	completeGoal,
	createGoal,
	deleteGoal,
	findGoalById,
	findGoalsByOrganizationId,
	getActiveGoalsCount,
	getGoalProgressSummary,
	getGoalsNearingDeadline,
	updateGoal,
	updateGoalProgress,
} from "@packages/database/repositories/goal-repository";
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
	linkedTagIds: z.array(z.string().uuid()).optional(),
	initialDebtAmount: z.number().optional(),
	interestRate: z.number().min(0).max(100).optional(),
	notes: z.string().max(1000).optional(),
});

const createGoalSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	type: z.enum(["savings", "debt_payoff", "spending_limit", "income_target"]),
	targetAmount: z.number().positive(),
	startingAmount: z.number().min(0).optional(),
	targetDate: z.string().datetime().optional(),
	isAutoTracked: z.boolean().optional(),
	metadata: goalMetadataSchema.optional(),
});

const updateGoalSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional().nullable(),
	status: z.enum(["active", "paused", "cancelled"]).optional(),
	targetAmount: z.number().positive().optional(),
	currentAmount: z.number().min(0).optional(),
	targetDate: z.string().datetime().optional().nullable(),
	isAutoTracked: z.boolean().optional(),
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

			return createGoal(resolvedCtx.db, {
				organizationId,
				createdBy: userId,
				name: input.name,
				description: input.description,
				type: input.type,
				targetAmount: input.targetAmount.toString(),
				startingAmount: input.startingAmount?.toString() ?? "0",
				currentAmount: input.startingAmount?.toString() ?? "0",
				targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
				isAutoTracked: input.isAutoTracked ?? false,
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
			if (input.description !== undefined) updateData.description = input.description;
			if (input.status !== undefined) updateData.status = input.status;
			if (input.targetAmount !== undefined) updateData.targetAmount = input.targetAmount.toString();
			if (input.currentAmount !== undefined) updateData.currentAmount = input.currentAmount.toString();
			if (input.targetDate !== undefined) {
				updateData.targetDate = input.targetDate ? new Date(input.targetDate) : null;
			}
			if (input.isAutoTracked !== undefined) updateData.isAutoTracked = input.isAutoTracked;
			if (input.metadata !== undefined) updateData.metadata = input.metadata as GoalMetadata;

			return updateGoal(resolvedCtx.db, input.id, updateData);
		}),

	updateProgress: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				currentAmount: z.number().min(0),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const resolvedCtx = await ctx;
			const organizationId = resolvedCtx.organizationId;

			const existing = await findGoalById(resolvedCtx.db, input.id);
			if (!existing || existing.organizationId !== organizationId) {
				throw APIError.notFound("Goal not found");
			}

			return updateGoalProgress(resolvedCtx.db, input.id, input.currentAmount.toString());
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
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const resolvedCtx = await ctx;
			const organizationId = resolvedCtx.organizationId;

			const existing = await findGoalById(resolvedCtx.db, input.id);
			if (!existing || existing.organizationId !== organizationId) {
				throw APIError.notFound("Goal not found");
			}

			return deleteGoal(resolvedCtx.db, input.id);
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
			z.object({
				status: z.enum(["active", "completed", "paused", "cancelled"]).optional(),
				type: z.enum(["savings", "debt_payoff", "spending_limit", "income_target"]).optional(),
				limit: z.number().min(1).max(100).optional(),
				offset: z.number().min(0).optional(),
			}).optional(),
		)
		.query(async ({ ctx, input }) => {
			const resolvedCtx = await ctx;
			const organizationId = resolvedCtx.organizationId;

			return findGoalsByOrganizationId(resolvedCtx.db, organizationId, input);
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
		.input(z.object({ daysAhead: z.number().min(1).max(365).optional() }).optional())
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
