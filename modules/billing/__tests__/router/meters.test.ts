import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { call } from "@orpc/server";
import dayjs from "dayjs";
import { and, count, eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { servicePrices, services } from "@core/database/schemas/services";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { categories } from "@core/database/schemas/categories";
import { meters } from "@core/database/schemas/meters";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { usageEvents } from "@core/database/schemas/usage-events";
import {
   attachBenefit,
   makeBenefit,
   makeContact,
   makeMeter,
   makePrice,
   makeService,
   makeSubscription,
   makeSubscriptionItem,
} from "../helpers/billing-factories";
import { createHyprpayMock } from "../helpers/hyprpay-mock";
import "../helpers/mock-billing-context";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as servicesRouter from "../../src/router/services";
import * as subscriptionsRouter from "../../src/router/subscriptions";
import * as metersRouter from "../../src/router/meters";
import * as benefitsRouter from "../../src/router/benefits";
import * as usageRouter from "../../src/router/usage";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

beforeEach(() => {
   vi.clearAllMocks();
});

async function makeCategory(
   db: Awaited<ReturnType<typeof setupTestDb>>["db"],
   opts: { teamId: string; name?: string },
) {
   const [row] = await db
      .insert(categories)
      .values({
         teamId: opts.teamId,
         name: opts.name ?? `Categoria ${crypto.randomUUID()}`,
         type: "expense",
      })
      .returning();
   if (!row) throw new Error("makeCategory: insert returned no row");
   return row;
}

describe("meters router", () => {
   describe("meters", () => {
      it("createMeter inserts row with teamId", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            metersRouter.createMeter,
            {
               name: "Medidor Novo",
               eventName: "billing.test_event",
               aggregation: "sum",
            },
            { context: ctx },
         );
         expect(result.teamId).toBe(teamId);
         expect(result.name).toBe("Medidor Novo");
         expect(result.eventName).toBe("billing.test_event");
      });

      it("getMeters returns only current team's meters ordered by name asc", async () => {
         const { teamId: teamA } = await seedTeam(testDb.db);
         const { teamId: teamB } = await seedTeam(testDb.db);
         await makeMeter(testDb.db, { teamId: teamA, name: "Beta" });
         await makeMeter(testDb.db, { teamId: teamA, name: "Alpha" });
         await makeMeter(testDb.db, { teamId: teamB, name: "OutroTime" });

         const ctx = createTestContext(testDb.db, {
            teamId: teamA,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(metersRouter.getMeters, undefined, {
            context: ctx,
         });
         expect(result).toHaveLength(2);
         expect(result.map((m) => m.name)).toEqual(["Alpha", "Beta"]);
      });

      it("getMeterById returns meter on happy path", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            metersRouter.getMeterById,
            { id: meter.id },
            { context: ctx },
         );
         expect(result.id).toBe(meter.id);
      });

      it("getMeterById throws NOT_FOUND for cross-team meter", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId: otherTeamId });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(metersRouter.getMeterById, { id: meter.id }, { context: ctx }),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("updateMeterById flips isActive and persists", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            metersRouter.updateMeterById,
            { id: meter.id, isActive: false },
            { context: ctx },
         );
         expect(result.isActive).toBe(false);

         const [persisted] = await testDb.db
            .select()
            .from(meters)
            .where(eq(meters.id, meter.id));
         expect(persisted?.isActive).toBe(false);
      });

      it("updateMeterById throws NOT_FOUND for cross-team meter", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId: otherTeamId });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               metersRouter.updateMeterById,
               { id: meter.id, isActive: false },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });

      it("removeMeter deletes the meter row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            metersRouter.removeMeter,
            { id: meter.id },
            { context: ctx },
         );
         expect(result).toEqual({ success: true });

         const rows = await testDb.db
            .select()
            .from(meters)
            .where(eq(meters.id, meter.id));
         expect(rows).toHaveLength(0);
      });

      it("removeMeter throws NOT_FOUND for cross-team meter", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId: otherTeamId });
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(metersRouter.removeMeter, { id: meter.id }, { context: ctx }),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });
   });
});
