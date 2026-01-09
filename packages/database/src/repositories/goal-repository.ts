import { AppError, propagateError } from "@packages/utils/errors";
import { and, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
	financialGoal,
	type FinancialGoal,
	type GoalStatus,
	type GoalType,
	type NewFinancialGoal,
} from "../schemas/goals";

export type { FinancialGoal, NewFinancialGoal, GoalType, GoalStatus } from "../schemas/goals";

export async function createGoal(
	dbClient: DatabaseInstance,
	data: NewFinancialGoal,
): Promise<FinancialGoal> {
	try {
		const result = await dbClient.insert(financialGoal).values(data).returning();
		const goal = result[0];
		if (!goal) {
			throw AppError.database("Failed to create goal - no result returned");
		}
		return goal;
	} catch (err) {
		propagateError(err);
		throw AppError.database(`Failed to create goal: ${(err as Error).message}`, {
			cause: err,
		});
	}
}

export async function findGoalById(
	dbClient: DatabaseInstance,
	goalId: string,
): Promise<FinancialGoal | undefined> {
	try {
		const result = await dbClient.query.financialGoal.findFirst({
			where: eq(financialGoal.id, goalId),
		});
		return result;
	} catch (err) {
		propagateError(err);
		throw AppError.database(`Failed to find goal by id: ${(err as Error).message}`);
	}
}

export async function findGoalsByOrganizationId(
	dbClient: DatabaseInstance,
	organizationId: string,
	options?: {
		status?: GoalStatus;
		type?: GoalType;
		limit?: number;
		offset?: number;
	},
): Promise<FinancialGoal[]> {
	const { status, type, limit = 50, offset = 0 } = options ?? {};
	try {
		const conditions = [eq(financialGoal.organizationId, organizationId)];

		if (status) {
			conditions.push(eq(financialGoal.status, status));
		}

		if (type) {
			conditions.push(eq(financialGoal.type, type));
		}

		const result = await dbClient.query.financialGoal.findMany({
			where: and(...conditions),
			orderBy: [desc(financialGoal.createdAt)],
			limit,
			offset,
		});
		return result;
	} catch (err) {
		propagateError(err);
		throw AppError.database(`Failed to find goals: ${(err as Error).message}`);
	}
}

export async function updateGoal(
	dbClient: DatabaseInstance,
	goalId: string,
	data: Partial<Omit<NewFinancialGoal, "id" | "organizationId" | "createdAt">>,
): Promise<FinancialGoal | undefined> {
	try {
		const result = await dbClient
			.update(financialGoal)
			.set(data)
			.where(eq(financialGoal.id, goalId))
			.returning();
		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(`Failed to update goal: ${(err as Error).message}`);
	}
}

export async function updateGoalProgress(
	dbClient: DatabaseInstance,
	goalId: string,
	currentAmount: string,
): Promise<FinancialGoal | undefined> {
	try {
		const result = await dbClient
			.update(financialGoal)
			.set({ currentAmount })
			.where(eq(financialGoal.id, goalId))
			.returning();
		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(`Failed to update goal progress: ${(err as Error).message}`);
	}
}

export async function completeGoal(
	dbClient: DatabaseInstance,
	goalId: string,
): Promise<FinancialGoal | undefined> {
	try {
		const result = await dbClient
			.update(financialGoal)
			.set({
				status: "completed",
				completedAt: new Date(),
			})
			.where(eq(financialGoal.id, goalId))
			.returning();
		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(`Failed to complete goal: ${(err as Error).message}`);
	}
}

export async function deleteGoal(
	dbClient: DatabaseInstance,
	goalId: string,
): Promise<boolean> {
	try {
		const result = await dbClient
			.delete(financialGoal)
			.where(eq(financialGoal.id, goalId))
			.returning({ id: financialGoal.id });
		return result.length > 0;
	} catch (err) {
		propagateError(err);
		throw AppError.database(`Failed to delete goal: ${(err as Error).message}`);
	}
}

export async function getActiveGoalsCount(
	dbClient: DatabaseInstance,
	organizationId: string,
): Promise<number> {
	try {
		const result = await dbClient.query.financialGoal.findMany({
			where: and(
				eq(financialGoal.organizationId, organizationId),
				eq(financialGoal.status, "active"),
			),
			columns: { id: true },
		});
		return result.length;
	} catch (err) {
		propagateError(err);
		throw AppError.database(`Failed to count goals: ${(err as Error).message}`);
	}
}

export async function getGoalsNearingDeadline(
	dbClient: DatabaseInstance,
	organizationId: string,
	daysAhead: number = 30,
): Promise<FinancialGoal[]> {
	try {
		const now = new Date();
		const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

		const result = await dbClient.query.financialGoal.findMany({
			where: and(
				eq(financialGoal.organizationId, organizationId),
				eq(financialGoal.status, "active"),
				isNotNull(financialGoal.targetDate),
				gte(financialGoal.targetDate, now),
				lte(financialGoal.targetDate, futureDate),
			),
			orderBy: [financialGoal.targetDate],
		});
		return result;
	} catch (err) {
		propagateError(err);
		throw AppError.database(`Failed to get goals nearing deadline: ${(err as Error).message}`);
	}
}

export type GoalProgressSummary = {
	goalId: string;
	name: string;
	type: GoalType;
	targetAmount: number;
	currentAmount: number;
	startingAmount: number;
	progressPercentage: number;
	remainingAmount: number;
	daysRemaining: number | null;
	isOnTrack: boolean;
	projectedCompletionDate: Date | null;
};

export async function getGoalProgressSummary(
	dbClient: DatabaseInstance,
	goalId: string,
): Promise<GoalProgressSummary | null> {
	try {
		const goal = await findGoalById(dbClient, goalId);
		if (!goal) return null;

		const targetAmount = Number(goal.targetAmount);
		const currentAmount = Number(goal.currentAmount);
		const startingAmount = Number(goal.startingAmount);

		// For savings goals, progress is current / target
		// For debt payoff, progress is (initial - current) / initial
		// For spending limit, progress is current / target (lower is better)
		let progressPercentage: number;
		let remainingAmount: number;

		if (goal.type === "debt_payoff") {
			const initialDebt = goal.metadata?.initialDebtAmount ?? targetAmount;
			progressPercentage = initialDebt > 0
				? ((initialDebt - currentAmount) / initialDebt) * 100
				: 0;
			remainingAmount = currentAmount;
		} else if (goal.type === "spending_limit") {
			progressPercentage = targetAmount > 0
				? (currentAmount / targetAmount) * 100
				: 0;
			remainingAmount = Math.max(0, targetAmount - currentAmount);
		} else {
			// savings, income_target
			progressPercentage = targetAmount > 0
				? (currentAmount / targetAmount) * 100
				: 0;
			remainingAmount = Math.max(0, targetAmount - currentAmount);
		}

		// Calculate days remaining
		let daysRemaining: number | null = null;
		if (goal.targetDate) {
			const now = new Date();
			daysRemaining = Math.max(
				0,
				Math.ceil((goal.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
			);
		}

		// Calculate if on track (simple linear projection)
		let isOnTrack = true;
		let projectedCompletionDate: Date | null = null;

		if (goal.targetDate && goal.startDate && currentAmount > startingAmount) {
			const daysSinceStart = Math.max(
				1,
				(new Date().getTime() - goal.startDate.getTime()) / (1000 * 60 * 60 * 24),
			);
			const progressRate = (currentAmount - startingAmount) / daysSinceStart;

			if (progressRate > 0) {
				const daysToComplete = remainingAmount / progressRate;
				projectedCompletionDate = new Date(
					new Date().getTime() + daysToComplete * 24 * 60 * 60 * 1000,
				);
				isOnTrack = projectedCompletionDate <= goal.targetDate;
			}
		}

		return {
			goalId: goal.id,
			name: goal.name,
			type: goal.type,
			targetAmount,
			currentAmount,
			startingAmount,
			progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
			remainingAmount,
			daysRemaining,
			isOnTrack,
			projectedCompletionDate,
		};
	} catch (err) {
		propagateError(err);
		throw AppError.database(`Failed to get goal progress: ${(err as Error).message}`);
	}
}
