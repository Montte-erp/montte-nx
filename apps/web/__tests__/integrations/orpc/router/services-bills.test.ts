import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
}));

import { bills } from "@core/database/schemas/bills";
import { contacts } from "@core/database/schemas/contacts";
import type { ContactSubscription } from "@core/database/schemas/subscriptions";
import type { ServiceVariant } from "@core/database/schemas/services";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import {
   generateBillsForSubscription,
   cancelPendingBillsForSubscription,
} from "@/integrations/orpc/router/services-bills";

let ctx: ORPCContextWithAuth;
let teamId: string;
let contactId: string;

const SUBSCRIPTION_ID = "a0000000-0000-4000-8000-000000000003";
const VARIANT_ID = "a0000000-0000-4000-8000-000000000004";
const SERVICE_ID = "a0000000-0000-4000-8000-000000000005";

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
   teamId = ctx.session!.session.activeTeamId!;
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM bills`);
   await ctx.db.execute(sql`DELETE FROM contacts`);

   const [contact] = await ctx.db
      .insert(contacts)
      .values({
         teamId,
         name: "Test Contact",
         type: "cliente",
      })
      .returning();
   contactId = contact!.id;
});

function makeSubscription(
   overrides?: Partial<ContactSubscription>,
): ContactSubscription {
   return {
      id: SUBSCRIPTION_ID,
      teamId,
      contactId,
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
      ...overrides,
   };
}

const baseVariant: ServiceVariant = {
   id: VARIANT_ID,
   serviceId: SERVICE_ID,
   teamId: "will-be-overridden",
   name: "Plano Mensal",
   basePrice: "500.00",
   billingCycle: "monthly",
   isActive: true,
   createdAt: new Date(),
   updatedAt: new Date(),
};

describe("generateBillsForSubscription", () => {
   it("skips hourly billing cycle", async () => {
      const variant = { ...baseVariant, billingCycle: "hourly" as const };
      await generateBillsForSubscription(
         makeSubscription(),
         variant,
         "Consultoria",
      );

      const rows = await ctx.db.query.bills.findMany();
      expect(rows).toHaveLength(0);
   });

   it("generates one bill for one_time cycle and persists it", async () => {
      const variant = { ...baseVariant, billingCycle: "one_time" as const };
      await generateBillsForSubscription(makeSubscription(), variant, "Setup");

      const rows = await ctx.db.query.bills.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
         teamId,
         contactId,
         subscriptionId: SUBSCRIPTION_ID,
         type: "receivable",
         status: "pending",
         amount: "500.00",
      });
      expect(rows[0]!.description).toContain("Pagamento único");
   });

   it("generates one bill for annual cycle", async () => {
      const variant = { ...baseVariant, billingCycle: "annual" as const };
      await generateBillsForSubscription(
         makeSubscription(),
         variant,
         "Licença",
      );

      const rows = await ctx.db.query.bills.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.dueDate).toBe("2026-01-01");
   });

   it("generates monthly bills up to endDate", async () => {
      const subscription = makeSubscription({
         startDate: "2026-01-15",
         endDate: "2026-03-15",
      });
      await generateBillsForSubscription(subscription, baseVariant, "Serviço");

      const rows = await ctx.db.query.bills.findMany({
         orderBy: { dueDate: "asc" },
      });
      expect(rows).toHaveLength(3);
      expect(rows[0]!.dueDate).toBe("2026-01-15");
      expect(rows[1]!.dueDate).toBe("2026-02-15");
      expect(rows[2]!.dueDate).toBe("2026-03-15");
   });

   it("generates monthly bills up to 2 years when no endDate", async () => {
      await generateBillsForSubscription(
         makeSubscription(),
         baseVariant,
         "Serviço",
      );

      const rows = await ctx.db.query.bills.findMany();
      expect(rows).toHaveLength(24);
   });
});

describe("cancelPendingBillsForSubscription", () => {
   it("updates pending bills to cancelled in the database", async () => {
      const variant = { ...baseVariant, billingCycle: "one_time" as const };
      await generateBillsForSubscription(makeSubscription(), variant, "Setup");

      const beforeRows = await ctx.db.query.bills.findMany();
      expect(beforeRows).toHaveLength(1);
      expect(beforeRows[0]!.status).toBe("pending");

      await cancelPendingBillsForSubscription(SUBSCRIPTION_ID);

      const afterRows = await ctx.db.query.bills.findMany();
      expect(afterRows).toHaveLength(1);
      expect(afterRows[0]!.status).toBe("cancelled");
   });

   it("does not affect already paid bills", async () => {
      const sub = makeSubscription({
         startDate: "2026-01-15",
         endDate: "2026-02-15",
      });
      await generateBillsForSubscription(sub, baseVariant, "Serviço");

      const rows = await ctx.db.query.bills.findMany({
         orderBy: { dueDate: "asc" },
      });
      expect(rows).toHaveLength(2);

      await ctx.db
         .update(bills)
         .set({ status: "paid", paidAt: new Date() })
         .where(sql`id = ${rows[0]!.id}`);

      await cancelPendingBillsForSubscription(SUBSCRIPTION_ID);

      const afterRows = await ctx.db.query.bills.findMany({
         orderBy: { dueDate: "asc" },
      });
      expect(afterRows[0]!.status).toBe("paid");
      expect(afterRows[1]!.status).toBe("cancelled");
   });
});
