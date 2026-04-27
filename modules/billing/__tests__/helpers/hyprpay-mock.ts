import { vi } from "vitest";

export function createHyprpayMock() {
   return {
      services: {
         ingestUsage: vi.fn(),
         createSubscription: vi.fn(),
         cancelSubscription: vi.fn(),
         getContactSubscriptions: vi.fn(),
         addItem: vi.fn(),
         updateItem: vi.fn(),
         removeItem: vi.fn(),
      },
      contacts: {
         create: vi.fn(),
         getAll: vi.fn(),
         getById: vi.fn(),
         getStats: vi.fn(),
         getTransactions: vi.fn(),
         update: vi.fn(),
         remove: vi.fn(),
         bulkRemove: vi.fn(),
         archive: vi.fn(),
         reactivate: vi.fn(),
      },
      coupons: {
         list: vi.fn(),
         get: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
         deactivate: vi.fn(),
         validate: vi.fn(),
      },
      customerPortal: {
         createSession: vi.fn(),
      },
   };
}

export type HyprpayMock = ReturnType<typeof createHyprpayMock>;
