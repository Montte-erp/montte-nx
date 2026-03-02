import { ORPCError, call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTestContext,
} from "../../../helpers/create-test-context";

import * as billingRouter from "@/integrations/orpc/router/billing";

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

const mockStripeClient = {
	invoices: {
		list: vi.fn(),
		createPreview: vi.fn(),
	},
};

const mockDb = {
	query: {
		user: {
			findFirst: vi.fn(),
		},
	},
};

function createBillingContext(overrides: Record<string, unknown> = {}) {
	return createTestContext({
		stripeClient: mockStripeClient,
		db: mockDb,
		...overrides,
	});
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
});

// =============================================================================
// getInvoices
// =============================================================================

describe("getInvoices", () => {
	it("returns formatted invoice list", async () => {
		mockDb.query.user.findFirst.mockResolvedValueOnce({
			stripeCustomerId: "cus_123",
		});
		mockStripeClient.invoices.list.mockResolvedValueOnce({
			data: [
				{
					id: "inv_1",
					number: "INV-001",
					amount_paid: 2000,
					amount_due: 0,
					currency: "brl",
					status: "paid",
					created: 1700000000,
					period_start: 1699900000,
					period_end: 1700000000,
					invoice_pdf: "https://stripe.com/pdf/inv_1",
					hosted_invoice_url: "https://stripe.com/inv_1",
				},
			],
		});

		const ctx = createBillingContext();
		const result = await call(billingRouter.getInvoices, { limit: 10 }, { context: ctx });

		expect(mockStripeClient.invoices.list).toHaveBeenCalledWith({
			customer: "cus_123",
			limit: 10,
		});
		expect(result).toEqual([
			{
				id: "inv_1",
				number: "INV-001",
				amountPaid: 2000,
				amountDue: 0,
				currency: "brl",
				status: "paid",
				created: 1700000000,
				periodStart: 1699900000,
				periodEnd: 1700000000,
				invoicePdf: "https://stripe.com/pdf/inv_1",
				hostedInvoiceUrl: "https://stripe.com/inv_1",
			},
		]);
	});

	it("returns empty array when user has no stripeCustomerId", async () => {
		mockDb.query.user.findFirst.mockResolvedValueOnce({
			stripeCustomerId: null,
		});

		const ctx = createBillingContext();
		const result = await call(billingRouter.getInvoices, undefined, { context: ctx });

		expect(result).toEqual([]);
		expect(mockStripeClient.invoices.list).not.toHaveBeenCalled();
	});

	it("throws INTERNAL_SERVER_ERROR when stripeClient is not configured", async () => {
		const ctx = createBillingContext({ stripeClient: undefined });

		await expect(
			call(billingRouter.getInvoices, undefined, { context: ctx }),
		).rejects.toSatisfy((e: ORPCError<string, unknown>) => e.code === "INTERNAL_SERVER_ERROR");
	});
});

// =============================================================================
// getUpcomingInvoice
// =============================================================================

describe("getUpcomingInvoice", () => {
	it("returns formatted upcoming invoice", async () => {
		mockDb.query.user.findFirst.mockResolvedValueOnce({
			stripeCustomerId: "cus_123",
		});
		mockStripeClient.invoices.createPreview.mockResolvedValueOnce({
			amount_due: 5000,
			currency: "brl",
			period_start: 1700000000,
			period_end: 1702600000,
			next_payment_attempt: 1702600000,
			lines: {
				data: [
					{
						description: "Pro Plan",
						amount: 5000,
						quantity: 1,
					},
				],
			},
		});

		const ctx = createBillingContext();
		const result = await call(billingRouter.getUpcomingInvoice, undefined, { context: ctx });

		expect(mockStripeClient.invoices.createPreview).toHaveBeenCalledWith({
			customer: "cus_123",
		});
		expect(result).toEqual({
			amountDue: 5000,
			currency: "brl",
			periodStart: 1700000000,
			periodEnd: 1702600000,
			nextPaymentAttempt: 1702600000,
			lines: [
				{
					description: "Pro Plan",
					amount: 5000,
					quantity: 1,
				},
			],
		});
	});

	it("returns null when user has no stripeCustomerId", async () => {
		mockDb.query.user.findFirst.mockResolvedValueOnce({
			stripeCustomerId: null,
		});

		const ctx = createBillingContext();
		const result = await call(billingRouter.getUpcomingInvoice, undefined, { context: ctx });

		expect(result).toBeNull();
		expect(mockStripeClient.invoices.createPreview).not.toHaveBeenCalled();
	});

	it("returns null when Stripe throws (canceled subscription)", async () => {
		mockDb.query.user.findFirst.mockResolvedValueOnce({
			stripeCustomerId: "cus_123",
		});
		mockStripeClient.invoices.createPreview.mockRejectedValueOnce(
			new Error("No upcoming invoices for customer"),
		);

		const ctx = createBillingContext();
		const result = await call(billingRouter.getUpcomingInvoice, undefined, { context: ctx });

		expect(result).toBeNull();
	});
});
