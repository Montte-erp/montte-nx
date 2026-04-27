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

describe("usage router", () => {
   describe("usage", () => {
      it("ingestUsage inserts a usage event row on happy path (by meterId)", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId });
         const idempotencyKey = crypto.randomUUID();

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            usageRouter.ingestUsage,
            {
               meterId: meter.id,
               quantity: "5",
               idempotencyKey,
            },
            { context: ctx },
         );
         expect(result).toEqual({ success: true });

         const rows = await testDb.db
            .select()
            .from(usageEvents)
            .where(
               and(
                  eq(usageEvents.teamId, teamId),
                  eq(usageEvents.idempotencyKey, idempotencyKey),
               ),
            );
         expect(rows).toHaveLength(1);
         expect(rows[0]?.meterId).toBe(meter.id);
         expect(Number(rows[0]?.quantity)).toBe(5);
      });

      it("ingestUsage resolves meter by eventName", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, {
            teamId,
            eventName: "ai.classify",
         });
         const idempotencyKey = crypto.randomUUID();

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            usageRouter.ingestUsage,
            {
               eventName: "ai.classify",
               quantity: "1",
               idempotencyKey,
            },
            { context: ctx },
         );
         expect(result).toEqual({ success: true });

         const rows = await testDb.db
            .select()
            .from(usageEvents)
            .where(
               and(
                  eq(usageEvents.teamId, teamId),
                  eq(usageEvents.idempotencyKey, idempotencyKey),
               ),
            );
         expect(rows).toHaveLength(1);
         expect(rows[0]?.meterId).toBe(meter.id);
      });

      it("ingestUsage no-ops when meter is not found", async () => {
         const { teamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            usageRouter.ingestUsage,
            {
               eventName: "no.meter.event",
               quantity: "1",
               idempotencyKey: crypto.randomUUID(),
            },
            { context: ctx },
         );
         expect(result).toEqual({ success: true });

         const rows = await testDb.db
            .select()
            .from(usageEvents)
            .where(eq(usageEvents.teamId, teamId));
         expect(rows).toHaveLength(0);
      });

      it("ingestUsage is idempotent — same idempotencyKey twice yields a single row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const meter = await makeMeter(testDb.db, { teamId });
         const idempotencyKey = crypto.randomUUID();

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const first = await call(
            usageRouter.ingestUsage,
            {
               meterId: meter.id,
               quantity: "1",
               idempotencyKey,
            },
            { context: ctx },
         );
         expect(first).toEqual({ success: true });

         const second = await call(
            usageRouter.ingestUsage,
            {
               meterId: meter.id,
               quantity: "9",
               idempotencyKey,
            },
            { context: ctx },
         );
         expect(second).toEqual({ success: true });

         const [row] = await testDb.db
            .select({ count: count() })
            .from(usageEvents)
            .where(
               and(
                  eq(usageEvents.teamId, teamId),
                  eq(usageEvents.idempotencyKey, idempotencyKey),
               ),
            );
         expect(row?.count).toBe(1);
      });
   });
});
