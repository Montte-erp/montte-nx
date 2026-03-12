import { beforeEach, describe, expect, it, vi } from "vitest";

const { resendClientMock, resendConstructorMock } = vi.hoisted(() => ({
   resendClientMock: {
      emails: {
         send: vi.fn(),
      },
   },
   resendConstructorMock: vi.fn(),
}));

vi.mock("@core/environment/server", () => ({
   env: {
      RESEND_API_KEY: "re_test_123",
   },
}));

vi.mock("resend", () => ({
   Resend: function MockResend(...args: unknown[]) {
      resendConstructorMock(...args);
      return resendClientMock;
   },
}));

describe("resend client", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.resetModules();
   });

   it("creates a Resend instance with env configuration", async () => {
      const { resendClient } = await import("../src/utils");

      expect(resendClient).toBe(resendClientMock);
      expect(resendConstructorMock).toHaveBeenCalledWith("re_test_123");
   });
});
