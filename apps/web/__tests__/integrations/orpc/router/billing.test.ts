import { ORPCError, call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
}));

import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as billingRouter from "@/integrations/orpc/router/billing";

let ctx: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
}, 30_000);

afterAll(async () => {
   await cleanupIntegrationTest();
});

const mockStripeClient = {
   invoices: {
      list: vi.fn(),
      createPreview: vi.fn(),
   },
   paymentMethods: {
      list: vi.fn(),
   },
   billing: {
      meters: {
         list: vi.fn(),
         listEventSummaries: vi.fn(),
      },
   },
};

function withStripe(base: ORPCContextWithAuth): ORPCContextWithAuth {
   return { ...base, stripeClient: mockStripeClient as any };
}

describe("getInvoices", () => {
   it("returns formatted invoice list", async () => {
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

      const stripeCtx = withStripe(ctx);
      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: "cus_123" })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

      const result = await call(
         billingRouter.getInvoices,
         { limit: 10 },
         { context: stripeCtx },
      );

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
      vi.clearAllMocks();

      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: null })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

      const stripeCtx = withStripe(ctx);
      const result = await call(billingRouter.getInvoices, undefined, {
         context: stripeCtx,
      });

      expect(result).toEqual([]);
      expect(mockStripeClient.invoices.list).not.toHaveBeenCalled();
   });

   it("throws INTERNAL_SERVER_ERROR when stripeClient is not configured", async () => {
      await expect(
         call(billingRouter.getInvoices, undefined, { context: ctx }),
      ).rejects.toSatisfy(
         (e: ORPCError<string, unknown>) => e.code === "INTERNAL_SERVER_ERROR",
      );
   });

   it("throws INTERNAL_SERVER_ERROR when stripe.invoices.list rejects", async () => {
      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: "cus_err" })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

      mockStripeClient.invoices.list.mockRejectedValueOnce(new Error("stripe error"));

      await expect(
         call(billingRouter.getInvoices, undefined, { context: withStripe(ctx) }),
      ).rejects.toSatisfy(
         (e: ORPCError<string, unknown>) => e.code === "INTERNAL_SERVER_ERROR",
      );
   });
});

function withFailingDb(base: ORPCContextWithAuth): ORPCContextWithAuth {
   const proxy = new Proxy(base.db, {
      get(target, prop) {
         if (prop === "select") return () => { throw new Error("simulated DB failure"); };
         return (target as any)[prop];
      },
   });
   return { ...base, db: proxy as any };
}

describe("getUpcomingInvoice", () => {
   it("throws when stripeClient is not configured", async () => {
      await expect(
         call(billingRouter.getUpcomingInvoice, undefined, { context: ctx }),
      ).rejects.toSatisfy(
         (e: ORPCError<string, unknown>) => e.code === "INTERNAL_SERVER_ERROR",
      );
   });

   it("returns formatted upcoming invoice", async () => {
      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: "cus_456" })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

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

      const stripeCtx = withStripe(ctx);
      const result = await call(billingRouter.getUpcomingInvoice, undefined, {
         context: stripeCtx,
      });

      expect(mockStripeClient.invoices.createPreview).toHaveBeenCalledWith({
         customer: "cus_456",
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
      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: null })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

      const stripeCtx = withStripe(ctx);
      const result = await call(billingRouter.getUpcomingInvoice, undefined, {
         context: stripeCtx,
      });

      expect(result).toBeNull();
   });

   it("returns null when Stripe throws (canceled subscription)", async () => {
      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: "cus_789" })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

      mockStripeClient.invoices.createPreview.mockRejectedValueOnce(
         new Error("No upcoming invoices for customer"),
      );

      const stripeCtx = withStripe(ctx);
      const result = await call(billingRouter.getUpcomingInvoice, undefined, {
         context: stripeCtx,
      });

      expect(result).toBeNull();
   });
});

describe("getPaymentStatus", () => {
   it("returns hasPaymentMethod false when stripeClient is not configured", async () => {
      const result = await call(billingRouter.getPaymentStatus, undefined, {
         context: ctx,
      });

      expect(result).toEqual({ hasPaymentMethod: false });
   });

   it("returns hasPaymentMethod false when user has no stripeCustomerId", async () => {
      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: null })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

      const stripeCtx = withStripe(ctx);
      const result = await call(billingRouter.getPaymentStatus, undefined, {
         context: stripeCtx,
      });

      expect(result).toEqual({ hasPaymentMethod: false });
   });

   it("returns hasPaymentMethod true when Stripe has a card", async () => {
      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: "cus_pay" })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

      mockStripeClient.paymentMethods.list.mockResolvedValueOnce({
         data: [{ id: "pm_123" }],
      });

      const stripeCtx = withStripe(ctx);
      const result = await call(billingRouter.getPaymentStatus, undefined, {
         context: stripeCtx,
      });

      expect(result).toEqual({ hasPaymentMethod: true });
   });
});

describe("getMeterUsage", () => {
   it("returns fallback when stripeClient is not configured", async () => {
      const result = await call(billingRouter.getMeterUsage, undefined, {
         context: ctx,
      });

      expect(Array.isArray(result)).toBe(true);
      for (const item of result) {
         expect(item.used).toBe(0);
         expect(typeof item.eventName).toBe("string");
         expect(typeof item.freeTierLimit).toBe("number");
         expect(typeof item.pricePerEvent).toBe("string");
      }
   });

   it("returns fallback when user has no stripeCustomerId", async () => {
      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: null })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

      const stripeCtx = withStripe(ctx);
      const result = await call(billingRouter.getMeterUsage, undefined, {
         context: stripeCtx,
      });

      expect(Array.isArray(result)).toBe(true);
      for (const item of result) {
         expect(item.used).toBe(0);
      }
   });

   it("returns aggregated usage from Stripe meter summaries", async () => {
      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: "cus_meter_test" })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

      mockStripeClient.billing.meters.list.mockResolvedValueOnce({
         data: [{ id: "meter_tx", event_name: "finance_transactions" }],
      });
      mockStripeClient.billing.meters.listEventSummaries.mockResolvedValueOnce({
         data: [
            { aggregated_value: 300 },
            { aggregated_value: 150 },
         ],
      });

      const stripeCtx = withStripe(ctx);
      const result = await call(billingRouter.getMeterUsage, undefined, {
         context: stripeCtx,
      });

      const txItem = result.find((r) => r.eventName === "finance.transaction_created");
      expect(txItem?.used).toBe(450);
   });

   it("returns zero usage for meters not found in Stripe", async () => {
      await ctx.db
         .update((await import("@core/database/schema")).user)
         .set({ stripeCustomerId: "cus_empty_meters" })
         .where(
            (await import("drizzle-orm")).eq(
               (await import("@core/database/schema")).user.id,
               ctx.session!.user.id,
            ),
         );

      mockStripeClient.billing.meters.list.mockResolvedValueOnce({ data: [] });

      const stripeCtx = withStripe(ctx);
      const result = await call(billingRouter.getMeterUsage, undefined, {
         context: stripeCtx,
      });

      for (const item of result) {
         expect(item.used).toBe(0);
      }
   });
});
