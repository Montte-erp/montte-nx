import { describe, expect, it, vi } from "vitest";

vi.mock("resend", () => {
   class MockResend {
      constructor(public apiKey: string) {}
      emails = { send: vi.fn() };
   }
   return { Resend: MockResend };
});

import { getResendClient } from "../src/utils";

describe("getResendClient", () => {
   it("creates a Resend instance with the provided key", () => {
      const client = getResendClient("re_test_123");
      expect(client).toBeDefined();
   });

   it("throws when key is missing", () => {
      expect(() => getResendClient("" as any)).toThrow(
         "RESEND_API_KEY is required",
      );
   });
});
