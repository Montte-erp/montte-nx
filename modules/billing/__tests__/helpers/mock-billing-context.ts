import { okAsync } from "neverthrow";
import { vi } from "vitest";

export const ssePublishSpy = vi.fn(
   (
      _redis: unknown,
      scope: { kind: string; id: string },
      event: { type: string; payload: unknown },
   ) =>
      okAsync({
         id: crypto.randomUUID(),
         type: event.type,
         scope,
         payload: event.payload,
         timestamp: new Date().toISOString(),
      }),
);

export const billingResendSpies = {
   sendBillingInvoiceGenerated: vi.fn().mockResolvedValue(undefined),
   sendBillingTrialExpired: vi.fn().mockResolvedValue(undefined),
   sendBillingTrialExpiryWarning: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../src/sse", async () => {
   return {
      billingSseEvents: {
         publish: ssePublishSpy,
         eventTypes: [
            "billing.trial_expiring",
            "billing.trial_completed",
            "billing.invoice_generated",
            "billing.benefit_granted",
            "billing.benefit_revoked",
            "billing.usage_ingested",
         ],
      },
   };
});

vi.mock("../../src/workflows/context", async (importOriginal) => {
   const actual =
      await importOriginal<typeof import("../../src/workflows/context")>();
   return {
      ...actual,
      getBillingRedis: () => ({}),
      getBillingResendClient: () => ({}),
   };
});

vi.mock("@core/transactional/client", () => ({
   sendBillingInvoiceGenerated: billingResendSpies.sendBillingInvoiceGenerated,
   sendBillingTrialExpired: billingResendSpies.sendBillingTrialExpired,
   sendBillingTrialExpiryWarning:
      billingResendSpies.sendBillingTrialExpiryWarning,
}));
