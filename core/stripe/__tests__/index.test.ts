import { beforeEach, describe, expect, it, vi } from "vitest";

const { stripeClientMock, stripeConstructorMock } = vi.hoisted(() => ({
   stripeClientMock: {
      billing: {
         meterEvents: {
            create: vi.fn(),
         },
      },
   },
   stripeConstructorMock: vi.fn(),
}));

vi.mock("@core/environment/web/server", () => ({
   env: {
      STRIPE_SECRET_KEY: "sk_test_123",
   },
}));

vi.mock("stripe", () => ({
   default: function MockStripe(...args: unknown[]) {
      stripeConstructorMock(...args);
      return stripeClientMock;
   },
}));

describe("stripe client", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.resetModules();
   });

   it("creates a Stripe instance with env configuration", async () => {
      const { stripeClient } = await import("../src/index");

      expect(stripeClient).toBe(stripeClientMock);
      expect(stripeConstructorMock).toHaveBeenCalledWith("sk_test_123", {
         apiVersion: "2026-02-25.clover",
      });
   });
});
