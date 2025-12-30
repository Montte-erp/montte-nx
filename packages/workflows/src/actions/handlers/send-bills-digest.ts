import {
	findOrganizationById,
	getOrganizationMembers,
} from "@packages/database/repositories/auth-repository";
import { findBillsDueWithinDays } from "@packages/database/repositories/bill-repository";
import type { Consequence } from "@packages/database/schema";
import {
	type BillDigestItem,
	type BillsDigestSummary,
	sendBillsDigestEmail,
} from "@packages/transactional/client";
import {
	type ActionHandler,
	type ActionHandlerContext,
	createActionResult,
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

export const sendBillsDigestHandler: ActionHandler = {
	type: "send_bills_digest",

	async execute(consequence: Consequence, context: ActionHandlerContext) {
		const {
			recipients = "owner",
			memberIds,
			detailLevel = "detailed",
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
			return createActionResult(
				consequence,
				false,
				undefined,
				"Organization not found",
			);
		}

		// Get members based on recipients config
		const members = await getOrganizationMembers(
			context.db,
			context.organizationId,
		);

		let recipientEmails: { email: string; name: string }[] = [];

		if (recipients === "owner") {
			const owner = members.find((m) => m.role === "owner");
			if (owner?.user?.email) {
				recipientEmails.push({
					email: owner.user.email,
					name: owner.user.name || "Usuario",
				});
			}
		} else if (recipients === "all_members") {
			recipientEmails = members
				.filter((m) => m.user?.email)
				.map((m) => ({
					email: m.user!.email,
					name: m.user!.name || "Usuario",
				}));
		} else if (recipients === "specific" && memberIds?.length) {
			recipientEmails = members
				.filter((m) => memberIds.includes(m.userId) && m.user?.email)
				.map((m) => ({
					email: m.user!.email,
					name: m.user!.name || "Usuario",
				}));
		}

		if (recipientEmails.length === 0) {
			return createSkippedResult(consequence, "No recipients found");
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

		if (filteredBills.length === 0 && !includeOverdue) {
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

		if (context.dryRun) {
			return createActionResult(consequence, true, {
				billsCount: billItems.length,
				dashboardUrl,
				detailLevel,
				dryRun: true,
				period,
				recipients: recipientEmails.map((r) => r.email),
				summary,
			});
		}

		if (!context.resendClient) {
			return createActionResult(
				consequence,
				false,
				undefined,
				"Email client not configured",
			);
		}

		// Send email to each recipient
		const results: { email: string; success: boolean; error?: string }[] = [];

		for (const recipient of recipientEmails) {
			try {
				await sendBillsDigestEmail(context.resendClient, {
					bills: billItems,
					dashboardUrl,
					detailLevel,
					email: recipient.email,
					organizationName: organization.name,
					period,
					summary,
					userName: recipient.name,
				});
				results.push({ email: recipient.email, success: true });
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				results.push({ email: recipient.email, error: message, success: false });
			}
		}

		const successCount = results.filter((r) => r.success).length;
		const allSuccess = successCount === results.length;

		return createActionResult(
			consequence,
			allSuccess,
			{
				billsCount: billItems.length,
				period,
				results,
				summary,
				totalRecipients: recipientEmails.length,
			},
			allSuccess
				? undefined
				: `${results.length - successCount} of ${results.length} emails failed`,
		);
	},

	validate(config) {
		const errors: string[] = [];

		if (
			config.recipients === "specific" &&
			(!config.memberIds || config.memberIds.length === 0)
		) {
			errors.push(
				"Member IDs are required when recipients is set to specific",
			);
		}

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
