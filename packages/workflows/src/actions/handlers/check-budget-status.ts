import {
	checkBudgetImpact,
	getBudgetsWithProgress,
} from "@packages/database/repositories/budget-repository";
import type { Consequence } from "@packages/database/schema";
import {
	type ActionHandler,
	type ActionHandlerContext,
	createActionResultWithOutput,
	createSkippedResult,
} from "../types";

type CheckBudgetStatusPayload = {
	alertThresholds?: number[];
	checkCurrentStatus?: boolean;
};

type BudgetStatusItem = {
	budgetId: string;
	budgetName: string;
	budgetAmount: number;
	currentSpent: number;
	percentage: number;
	threshold: number | null;
	status: "normal" | "warning" | "danger" | "exceeded";
	message: string;
};

function getStatusFromPercentage(
	percentage: number,
	thresholds: number[],
): { status: "normal" | "warning" | "danger" | "exceeded"; threshold: number | null } {
	if (percentage >= 100) {
		return { status: "exceeded", threshold: 100 };
	}

	// Sort thresholds in descending order
	const sortedThresholds = [...thresholds].sort((a, b) => b - a);

	for (const threshold of sortedThresholds) {
		if (percentage >= threshold) {
			if (threshold >= 80) {
				return { status: "danger", threshold };
			}
			return { status: "warning", threshold };
		}
	}

	return { status: "normal", threshold: null };
}

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(amount);
}

export const checkBudgetStatusHandler: ActionHandler = {
	type: "check_budget_status",

	async execute(consequence: Consequence, context: ActionHandlerContext) {
		const {
			alertThresholds = [50, 80, 100],
			checkCurrentStatus = true,
		} = consequence.payload as CheckBudgetStatusPayload;

		console.log(`[CheckBudgetStatus] Starting: orgId=${context.organizationId}`);

		// Get all budgets with their current progress
		const budgetsWithProgress = await getBudgetsWithProgress(
			context.db,
			context.organizationId,
		);

		if (budgetsWithProgress.length === 0) {
			return createSkippedResult(consequence, "No budgets found for the organization");
		}

		// Filter to only active budgets
		const activeBudgets = budgetsWithProgress.filter((b) => b.isActive);

		if (activeBudgets.length === 0) {
			return createSkippedResult(consequence, "No active budgets found");
		}

		// Check each budget against thresholds
		const budgetStatuses: BudgetStatusItem[] = [];
		const alertBudgets: BudgetStatusItem[] = [];

		for (const budget of activeBudgets) {
			const { status, threshold } = getStatusFromPercentage(
				budget.progress.percentage,
				alertThresholds,
			);

			const budgetAmount = parseFloat(budget.amount);
			let message = "";

			switch (status) {
				case "exceeded":
					message = `Orçamento "${budget.name}" foi excedido (${budget.progress.percentage.toFixed(1)}%)`;
					break;
				case "danger":
					message = `Orçamento "${budget.name}" está em nível crítico (${budget.progress.percentage.toFixed(1)}%)`;
					break;
				case "warning":
					message = `Orçamento "${budget.name}" atingiu ${budget.progress.percentage.toFixed(1)}% do limite`;
					break;
				default:
					message = `Orçamento "${budget.name}" está dentro do esperado (${budget.progress.percentage.toFixed(1)}%)`;
			}

			const statusItem: BudgetStatusItem = {
				budgetAmount,
				budgetId: budget.id,
				budgetName: budget.name,
				currentSpent: budget.progress.spent,
				message,
				percentage: budget.progress.percentage,
				status,
				threshold,
			};

			budgetStatuses.push(statusItem);

			// Add to alerts if status is not normal
			if (status !== "normal") {
				alertBudgets.push(statusItem);
			}
		}

		// If no budgets need alerting, skip
		if (alertBudgets.length === 0 && checkCurrentStatus) {
			return createSkippedResult(
				consequence,
				"All budgets are within normal limits",
			);
		}

		console.log(`[CheckBudgetStatus] Found ${alertBudgets.length} budgets requiring attention`);

		// Sort alerts by severity (exceeded > danger > warning)
		const severityOrder = { exceeded: 0, danger: 1, warning: 2, normal: 3 };
		alertBudgets.sort((a, b) => severityOrder[a.status] - severityOrder[b.status]);

		// Summary
		const summary = {
			dangerCount: alertBudgets.filter((b) => b.status === "danger").length,
			exceededCount: alertBudgets.filter((b) => b.status === "exceeded").length,
			normalCount: budgetStatuses.filter((b) => b.status === "normal").length,
			totalActiveBudgets: activeBudgets.length,
			totalAlertBudgets: alertBudgets.length,
			warningCount: alertBudgets.filter((b) => b.status === "warning").length,
		};

		// Return data for downstream actions (e.g., send_push_notification, send_email)
		return createActionResultWithOutput(
			consequence,
			true,
			{
				alertBudgets,
				allBudgets: budgetStatuses,
				hasAlerts: alertBudgets.length > 0,
				summary,
				// Formatted messages for notifications
				alertMessage:
					alertBudgets.length > 0
						? alertBudgets[0]?.message ?? "Alerta de orçamento"
						: "Todos os orçamentos estão dentro do esperado",
				alertTitle:
					summary.exceededCount > 0
						? "Orçamento Excedido!"
						: summary.dangerCount > 0
							? "Orçamento em Nível Crítico"
							: "Alerta de Orçamento",
			},
			{
				alertCount: alertBudgets.length,
				dangerCount: summary.dangerCount,
				exceededCount: summary.exceededCount,
			},
		);
	},

	validate(config) {
		const errors: string[] = [];
		const payload = config as CheckBudgetStatusPayload;

		if (payload.alertThresholds) {
			if (!Array.isArray(payload.alertThresholds)) {
				errors.push("alertThresholds must be an array of numbers");
			} else {
				for (const threshold of payload.alertThresholds) {
					if (typeof threshold !== "number" || threshold < 0 || threshold > 100) {
						errors.push("Each threshold must be a number between 0 and 100");
						break;
					}
				}
			}
		}

		return { errors, valid: errors.length === 0 };
	},
};
