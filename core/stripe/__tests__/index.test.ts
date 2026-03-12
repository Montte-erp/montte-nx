import { describe, expect, it, vi } from "vitest";

vi.mock("stripe", () => {
   return {
      default: class MockStripe {
         constructor() {
            return { billing: { meterEvents: { create: vi.fn() } } };
         }
      },
   };
});

vi.mock("@core/logging/errors", () => ({
   AppError: {
      validation: (msg: string) => new Error(msg),
   },
}));

import { getStripeClient } from "../src/index";

describe("getStripeClient", () => {
   it("creates a Stripe instance with the provided key", () => {
      const client = getStripeClient("sk_test_123");
      expect(client).toBeDefined();
   });

   it("throws when key is missing", () => {
      expect(() => getStripeClient("" as any)).toThrow(
         "Stripe key is required",
      );
   });
});
