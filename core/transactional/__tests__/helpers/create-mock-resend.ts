import { vi } from "vitest";
import type { Resend } from "resend";

export function createMockResend() {
   return {
      emails: {
         send: vi.fn().mockResolvedValue({ data: { id: "email_123" } }),
      },
   } as unknown as Resend & {
      emails: {
         send: ReturnType<typeof vi.fn>;
      };
   };
}
