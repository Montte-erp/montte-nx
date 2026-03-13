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

vi.mock("stripe", () => ({
   default: function MockStripe(...args: unknown[]) {
      stripeConstructorMock(...args);
      return stripeClientMock;
   },
}));

import { createStripeClient } from "../src/index";

describe("stripe client", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("creates a Stripe instance with provided secret key", () => {
      const client = createStripeClient("sk_test_123");

      expect(client).toBe(stripeClientMock);
      expect(stripeConstructorMock).toHaveBeenCalledWith("sk_test_123", {
         apiVersion: "2026-02-25.clover",
      });
   });
});
