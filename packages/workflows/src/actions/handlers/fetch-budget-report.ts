import {
	getBudgetsWithProgress,
	getBudgetStats,
	type BudgetStats,
} from "@packages/database/repositories/budget-repository";
import type { Consequence } from "@packages/database/schema";
import {
	type ActionHandler,
	type ActionHandlerContext,
	createActionResultWithOutput,
	createSkippedResult,
} from "../types";

type FetchBudgetReportPayload = {
	includeOverBudget?: boolean;
	includeNearLimit?: boolean;
	budgetIds?: string[];
	includeInactive?: boolean;
};

type BudgetReportItem = {
	id: string;
	name: string;
	description: string | null;
	amount: string;
	spent: number;
	scheduled: number;
	available: number;
	percentage: number;
	periodType: string;
	isActive: boolean;
	isOverBudget: boolean;
	isNearLimit: boolean;
	tagId: string;
};

type BudgetReportSummary = {
	totalBudgeted: number;
	totalSpent: number;
	totalAvailable: number;
	overBudgetCount: number;
	nearLimitCount: number;
	activeBudgetCount: number;
	averageUtilization: number;
};

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(amount);
}

export const fetchBudgetReportHandler: ActionHandler = {
	type: "fetch_budget_report",

	async execute(consequence: Consequence, context: ActionHandlerContext) {
		const {
			includeOverBudget = true,
			includeNearLimit = true,
			budgetIds,
			includeInactive = false,
		} = consequence.payload as FetchBudgetReportPayload;

		console.log(`[FetchBudgetReport] Starting: orgId=${context.organizationId}`);

		// Get all budgets with progress
		const budgetsWithProgress = await getBudgetsWithProgress(
			context.db,
			context.organizationId,
		);

		if (budgetsWithProgress.length === 0) {
			return createSkippedResult(consequence, "No budgets found for the organization");
		}

		// Filter by budget IDs if specified
		let filteredBudgets = budgetIds?.length
			? budgetsWithProgress.filter((b) => budgetIds.includes(b.id))
			: budgetsWithProgress;

		// Filter by active status
		if (!includeInactive) {
			filteredBudgets = filteredBudgets.filter((b) => b.isActive);
		}

		// Filter by budget status
		if (!includeOverBudget && !includeNearLimit) {
			// If both are false, include all budgets
		} else {
			const includeAll = includeOverBudget && includeNearLimit;
			if (!includeAll) {
				filteredBudgets = filteredBudgets.filter((b) => {
					const isOverBudget = b.progress.percentage >= 100;
					const isNearLimit = b.progress.percentage >= 80 && b.progress.percentage < 100;

					if (includeOverBudget && isOverBudget) return true;
					if (includeNearLimit && isNearLimit) return true;
					return false;
				});
			}
		}

		if (filteredBudgets.length === 0) {
			return createSkippedResult(consequence, "No budgets match the filter criteria");
		}

		// Get overall stats
		const stats: BudgetStats = await getBudgetStats(
			context.db,
			context.organizationId,
		);

		// Build budget items for output
		const budgetItems: BudgetReportItem[] = filteredBudgets.map((b) => ({
			amount: b.amount,
			available: b.progress.available,
			description: b.description,
			id: b.id,
			isActive: b.isActive,
			isNearLimit: b.progress.percentage >= 80 && b.progress.percentage < 100,
			isOverBudget: b.progress.percentage >= 100,
			name: b.name,
			percentage: b.progress.percentage,
			periodType: b.periodType,
			scheduled: b.progress.scheduled,
			spent: b.progress.spent,
			tagId: b.tagId,
		}));

		// Calculate summary for filtered budgets
		const summary: BudgetReportSummary = {
			activeBudgetCount: filteredBudgets.filter((b) => b.isActive).length,
			averageUtilization:
				filteredBudgets.length > 0
					? filteredBudgets.reduce((sum, b) => sum + b.progress.percentage, 0) /
					  filteredBudgets.length
					: 0,
			nearLimitCount: filteredBudgets.filter(
				(b) => b.progress.percentage >= 80 && b.progress.percentage < 100,
			).length,
			overBudgetCount: filteredBudgets.filter((b) => b.progress.percentage >= 100).length,
			totalAvailable: filteredBudgets.reduce((sum, b) => sum + b.progress.available, 0),
			totalBudgeted: filteredBudgets.reduce((sum, b) => sum + parseFloat(b.amount), 0),
			totalSpent: filteredBudgets.reduce((sum, b) => sum + b.progress.spent, 0),
		};

		console.log(`[FetchBudgetReport] Found ${budgetItems.length} budgets, ${summary.overBudgetCount} over budget, ${summary.nearLimitCount} near limit`);

		// Return budget data for downstream actions
		return createActionResultWithOutput(
			consequence,
			true,
			{
				budgets: budgetItems,
				budgetsCount: budgetItems.length,
				overallStats: stats,
				summary,
				// Formatted values for email templates
				formattedSummary: {
					averageUtilization: `${summary.averageUtilization.toFixed(1)}%`,
					totalAvailable: formatCurrency(summary.totalAvailable),
					totalBudgeted: formatCurrency(summary.totalBudgeted),
					totalSpent: formatCurrency(summary.totalSpent),
				},
			},
			{
				budgetsCount: budgetItems.length,
				nearLimitCount: summary.nearLimitCount,
				overBudgetCount: summary.overBudgetCount,
			},
		);
	},

	validate(config) {
		const errors: string[] = [];
		const payload = config as FetchBudgetReportPayload;

		if (payload.budgetIds?.length === 0) {
			errors.push("budgetIds array cannot be empty when provided");
		}

		return { errors, valid: errors.length === 0 };
	},
};
