import { vi } from "vitest";
import type Stripe from "stripe";

export function createMockStripe() {
   return {
      billing: {
         meterEvents: {
            create: vi.fn().mockResolvedValue({ identifier: "evt_123" }),
         },
      },
      customers: {
         create: vi.fn().mockResolvedValue({ id: "cus_123" }),
      },
      subscriptions: {
         list: vi.fn().mockResolvedValue({ data: [] }),
      },
   } as unknown as Stripe & {
      billing: {
         meterEvents: {
            create: ReturnType<typeof vi.fn>;
         };
      };
      customers: {
         create: ReturnType<typeof vi.fn>;
      };
      subscriptions: {
         list: ReturnType<typeof vi.fn>;
      };
   };
}
