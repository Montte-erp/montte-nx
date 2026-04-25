import { vi } from "vitest";

export function createHyprpayMock() {
   return {
      usage: { list: vi.fn() },
      customerPortal: { createSession: vi.fn() },
      coupons: { validate: vi.fn() },
   };
}

export type HyprpayMock = ReturnType<typeof createHyprpayMock>;
