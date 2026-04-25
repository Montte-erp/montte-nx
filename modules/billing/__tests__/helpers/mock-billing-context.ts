import { vi } from "vitest";

export const billingPublisherSpy = vi.fn().mockResolvedValue(undefined);

export const billingResendSpies = {
   sendBillingInvoiceGenerated: vi.fn().mockResolvedValue(undefined),
   sendBillingTrialExpired: vi.fn().mockResolvedValue(undefined),
   sendBillingTrialExpiryWarning: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../src/workflows/context", async () => {
   const actual = await vi.importActual<
      typeof import("../../src/workflows/context")
   >("../../src/workflows/context");
   return {
      ...actual,
      getBillingPublisher: () => ({ publish: billingPublisherSpy }),
      getBillingResendClient: () => ({}) as never,
   };
});

vi.mock("@core/transactional/client", () => ({
   sendBillingInvoiceGenerated: billingResendSpies.sendBillingInvoiceGenerated,
   sendBillingTrialExpired: billingResendSpies.sendBillingTrialExpired,
   sendBillingTrialExpiryWarning:
      billingResendSpies.sendBillingTrialExpiryWarning,
}));
