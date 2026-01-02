import { findOrganizationById } from "@packages/database/repositories/auth-repository";
import { findBillsDueWithinDays } from "@packages/database/repositories/bill-repository";
import type { Consequence } from "@packages/database/schema";
import type { BillDigestItem, BillsDigestSummary } from "@packages/transactional/client";
import { getBillsPageUrl } from "../../constants";
import { formatCurrency, formatDate, getPeriodLabel } from "../../utils/bills-helpers";
import {
	type ActionHandler,
	type ActionHandlerContext,
	createActionResultWithOutput,
	createSkippedResult,
} from "../types";

export const fetchBillsReportHandler: ActionHandler = {
	type: "fetch_bills_report",

	async execute(consequence: Consequence, context: ActionHandlerContext) {
		const {
			includePending = true,
			includeOverdue = true,
			daysAhead = 7,
			billTypes,
		} = consequence.payload;

		console.log(`[FetchBillsReport] Starting: includePending=${includePending}, includeOverdue=${includeOverdue}, daysAhead=${daysAhead}, orgId=${context.organizationId}`);

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

		console.log(`[FetchBillsReport] Found ${bills.length} bills from query`);

		// Filter by bill types if both are selected (default) or filter out specific types
		const filteredBills =
			billTypes && billTypes.length > 0
				? bills.filter((b) => billTypes.includes(b.type as "expense" | "income"))
				: bills;

		console.log(`[FetchBillsReport] After filtering: ${filteredBills.length} bills`);

		if (filteredBills.length === 0) {
			console.log("[FetchBillsReport] No bills found, skipping action");
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

		const dashboardUrl = getBillsPageUrl(organization.slug);
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
