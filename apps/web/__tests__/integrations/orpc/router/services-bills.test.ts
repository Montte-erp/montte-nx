import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();

vi.mock("@core/database/client", () => ({
   db: {
      insert: (...args: unknown[]) => {
         mockInsert(...args);
         return {
            values: (...vArgs: unknown[]) => {
               mockValues(...vArgs);
               return Promise.resolve();
            },
         };
      },
      update: (...args: unknown[]) => {
         mockUpdate(...args);
         return {
            set: (...sArgs: unknown[]) => {
               mockSet(...sArgs);
               return {
                  where: (...wArgs: unknown[]) => {
                     mockWhere(...wArgs);
                     return Promise.resolve();
                  },
               };
            },
         };
      },
   },
}));

import type { ContactSubscription } from "@core/database/schemas/subscriptions";
import type { ServiceVariant } from "@core/database/schemas/services";
import {
   generateBillsForSubscription,
   cancelPendingBillsForSubscription,
} from "@/integrations/orpc/router/services-bills";

const TEAM_ID = "a0000000-0000-4000-8000-000000000001";
const CONTACT_ID = "a0000000-0000-4000-8000-000000000002";
const SUBSCRIPTION_ID = "a0000000-0000-4000-8000-000000000003";
const VARIANT_ID = "a0000000-0000-4000-8000-000000000004";
const SERVICE_ID = "a0000000-0000-4000-8000-000000000005";

const baseSubscription: ContactSubscription = {
   id: SUBSCRIPTION_ID,
   teamId: TEAM_ID,
   contactId: CONTACT_ID,
   variantId: VARIANT_ID,
   startDate: "2026-01-01",
   endDate: null,
   negotiatedPrice: "500.00",
   notes: null,
   status: "active",
   source: "manual",
   externalId: null,
   currentPeriodStart: null,
   currentPeriodEnd: null,
   cancelAtPeriodEnd: false,
   canceledAt: null,
   createdAt: new Date(),
   updatedAt: new Date(),
};

const baseVariant: ServiceVariant = {
   id: VARIANT_ID,
   serviceId: SERVICE_ID,
   teamId: TEAM_ID,
   name: "Plano Mensal",
   basePrice: "500.00",
   billingCycle: "monthly",
   isActive: true,
   createdAt: new Date(),
   updatedAt: new Date(),
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("generateBillsForSubscription", () => {
   it("skips hourly billing cycle", async () => {
      const variant = { ...baseVariant, billingCycle: "hourly" as const };
      await generateBillsForSubscription(
         baseSubscription,
         variant,
         "Consultoria",
      );
      expect(mockInsert).not.toHaveBeenCalled();
   });

   it("generates one bill for one_time cycle", async () => {
      const variant = { ...baseVariant, billingCycle: "one_time" as const };
      await generateBillsForSubscription(baseSubscription, variant, "Setup");
      expect(mockValues).toHaveBeenCalledTimes(1);
      const bills = mockValues.mock.calls[0][0];
      expect(bills).toHaveLength(1);
      expect(bills[0]).toMatchObject({
         teamId: TEAM_ID,
         contactId: CONTACT_ID,
         subscriptionId: SUBSCRIPTION_ID,
         type: "receivable",
         status: "pending",
         amount: "500.00",
      });
      expect(bills[0].description).toContain("Pagamento único");
   });

   it("generates one bill for annual cycle", async () => {
      const variant = { ...baseVariant, billingCycle: "annual" as const };
      await generateBillsForSubscription(baseSubscription, variant, "Licença");
      const bills = mockValues.mock.calls[0][0];
      expect(bills).toHaveLength(1);
      expect(bills[0].dueDate).toBe("2026-01-01");
   });

   it("generates monthly bills up to endDate", async () => {
      const subscription = {
         ...baseSubscription,
         startDate: "2026-01-15",
         endDate: "2026-03-15",
      };
      await generateBillsForSubscription(subscription, baseVariant, "Serviço");
      const bills = mockValues.mock.calls[0][0];
      expect(bills.length).toBe(3);
      expect(bills[0].dueDate).toBe("2026-01-15");
      expect(bills[1].dueDate).toBe("2026-02-15");
      expect(bills[2].dueDate).toBe("2026-03-15");
   });

   it("generates monthly bills up to 2 years when no endDate", async () => {
      await generateBillsForSubscription(
         baseSubscription,
         baseVariant,
         "Serviço",
      );
      const bills = mockValues.mock.calls[0][0];
      expect(bills.length).toBe(24);
   });
});

describe("cancelPendingBillsForSubscription", () => {
   it("updates pending bills to cancelled", async () => {
      await cancelPendingBillsForSubscription(SUBSCRIPTION_ID);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith({ status: "cancelled" });
      expect(mockWhere).toHaveBeenCalledTimes(1);
   });
});
