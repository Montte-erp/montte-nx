import { findOrganizationById } from "@packages/database/repositories/auth-repository";
import { findBillsDueWithinDays } from "@packages/database/repositories/bill-repository";
import type { Consequence } from "@packages/database/schema";
import type { BillDigestItem, BillsDigestSummary } from "@packages/transactional/client";
import {
	type ActionHandler,
	type ActionHandlerContext,
	createActionResultWithOutput,
	createSkippedResult,
} from "../types";

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("pt-BR", {
		currency: "BRL",
		style: "currency",
	}).format(value);
}

function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
}

function getPeriodLabel(daysAhead: number): string {
	if (daysAhead <= 1) return "hoje";
	if (daysAhead <= 7) return "esta semana";
	if (daysAhead <= 14) return "proximas duas semanas";
	if (daysAhead <= 30) return "este mes";
	return `proximos ${daysAhead} dias`;
}

export const fetchBillsReportHandler: ActionHandler = {
	type: "fetch_bills_report",

	async execute(consequence: Consequence, context: ActionHandlerContext) {
		const {
			includePending = true,
			includeOverdue = true,
			daysAhead = 7,
			billTypes,
		} = consequence.payload;

		// Validate configuration
		if (!includePending && !includeOverdue) {
			return createSkippedResult(
				consequence,
				"At least one of includePending or includeOverdue must be true",
			);
		}

		// Get organization info
		const organization = await findOrganizationById(
			context.db,
			context.organizationId,
		);
		if (!organization) {
			return createActionResultWithOutput(
				consequence,
				false,
				{},
				undefined,
				"Organization not found",
			);
		}

		// Fetch bills
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// For each billType, fetch bills
		const typeFilter =
			billTypes && billTypes.length === 1 ? billTypes[0] : undefined;

		const bills = await findBillsDueWithinDays(
			context.db,
			context.organizationId,
			daysAhead,
			{
				includeOverdue,
				type: typeFilter,
			},
		);

		// Filter by bill types if both are selected (default) or filter out specific types
		const filteredBills =
			billTypes && billTypes.length > 0
				? bills.filter((b) => billTypes.includes(b.type as "expense" | "income"))
				: bills;

		if (filteredBills.length === 0) {
			return createSkippedResult(consequence, "No bills found for the period");
		}

		// Calculate summary
		let totalExpenseAmount = 0;
		let totalIncomeAmount = 0;
		let totalOverdue = 0;

		const billItems: BillDigestItem[] = filteredBills.map((bill) => {
			const amount = Number(bill.amount);
			const dueDate = new Date(bill.dueDate);
			const isOverdue = dueDate < today && !bill.completionDate;

			if (bill.type === "expense") {
				totalExpenseAmount += amount;
			} else {
				totalIncomeAmount += amount;
			}

			if (isOverdue) {
				totalOverdue++;
			}

			return {
				amount: formatCurrency(amount),
				description: bill.description || "Sem descricao",
				dueDate: formatDate(dueDate),
				isOverdue,
				type: bill.type as "expense" | "income",
			};
		});

		const summary: BillsDigestSummary = {
			totalExpenseAmount: formatCurrency(totalExpenseAmount),
			totalIncomeAmount: formatCurrency(totalIncomeAmount),
			totalOverdue,
			totalPending: billItems.length - totalOverdue,
		};

		const dashboardUrl = `https://app.montte.co/${organization.slug}/bills`;
		const period = getPeriodLabel(daysAhead);

		// Return the bills data in outputData for subsequent actions
		return createActionResultWithOutput(
			consequence,
			true,
			{
				bills: billItems,
				billsCount: billItems.length,
				dashboardUrl,
				organizationName: organization.name,
				period,
				summary,
				totalExpenseAmount,
				totalIncomeAmount,
				totalOverdue,
			},
			{
				billsCount: billItems.length,
				period,
			},
		);
	},

	validate(config) {
		const errors: string[] = [];

		if (!config.includePending && !config.includeOverdue) {
			errors.push(
				"At least one of includePending or includeOverdue must be true",
			);
		}

		if (config.daysAhead !== undefined && config.daysAhead < 0) {
			errors.push("daysAhead must be a positive number");
		}

		return { errors, valid: errors.length === 0 };
	},
};
