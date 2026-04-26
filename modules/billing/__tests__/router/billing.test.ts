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
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { eventCatalog } from "@core/database/schemas/event-catalog";
import { createHyprpayMock } from "../helpers/hyprpay-mock";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as billing from "../../src/router/billing";

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

describe("billing router", () => {
   describe("getEventCatalog", () => {
      it("returns rows ordered by category, then displayName", async () => {
         const { teamId } = await seedTeam(testDb.db);
         await testDb.db.insert(eventCatalog).values([
            {
               id: crypto.randomUUID(),
               eventName: "evt.a1",
               displayName: "Zebra",
               category: "ai",
               pricePerEvent: "0",
               isBillable: false,
            },
            {
               id: crypto.randomUUID(),
               eventName: "evt.b1",
               displayName: "Alfa",
               category: "ai",
               pricePerEvent: "0",
               isBillable: false,
            },
            {
               id: crypto.randomUUID(),
               eventName: "evt.c1",
               displayName: "Charlie",
               category: "finance",
               pricePerEvent: "0",
               isBillable: false,
            },
         ]);

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(billing.getEventCatalog, undefined, {
            context: ctx,
         });
         const ordered = result
            .filter((r) => r.eventName.startsWith("evt."))
            .map((r) => r.eventName);
         expect(ordered).toEqual(["evt.b1", "evt.a1", "evt.c1"]);
      });

      it("throws INTERNAL when db query fails", async () => {
         const ctx = createTestContext(testDb.db, {
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const brokenCtx = {
            ...ctx,
            db: {
               ...ctx.db,
               query: {
                  ...ctx.db.query,
                  eventCatalog: {
                     findMany: vi.fn().mockRejectedValue(new Error("boom")),
                  },
               },
            },
         };
         await expect(
            call(billing.getEventCatalog, undefined, { context: brokenCtx }),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) =>
               e.code === "INTERNAL_SERVER_ERROR",
         );
      });
   });
});
