import { beforeEach, describe, expect, it, vi } from "vitest";

const { resendClientMock, resendConstructorMock } = vi.hoisted(() => ({
   resendClientMock: {
      emails: {
         send: vi.fn(),
      },
   },
   resendConstructorMock: vi.fn(),
}));

vi.mock("resend", () => ({
   Resend: function MockResend(...args: unknown[]) {
      resendConstructorMock(...args);
      return resendClientMock;
   },
}));

import { createResendClient } from "../src/utils";

describe("resend client", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("creates a Resend instance with provided API key", () => {
      const client = createResendClient("re_test_123");

      expect(client).toBe(resendClientMock);
      expect(resendConstructorMock).toHaveBeenCalledWith("re_test_123");
   });
});
