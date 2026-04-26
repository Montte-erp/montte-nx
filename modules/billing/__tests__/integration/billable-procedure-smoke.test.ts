import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { call, onSuccess, os } from "@orpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import { meters } from "@core/database/schemas/meters";
import { usageEvents } from "@core/database/schemas/usage-events";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { clearMeterCache, ingestUsageEvent } from "@core/hyprpay/usage";

type SmokeContext = {
   db: DatabaseInstance;
   teamId: string;
   organizationId: string;
};
type BillableMeta = { billableEvent?: string };

const base = os.$context<SmokeContext>().$meta<BillableMeta>({});

const billable = base.use(
   onSuccess(async (_result, { context, procedure }) => {
      const eventName = procedure["~orpc"].meta.billableEvent;
      if (!eventName) return;
      await ingestUsageEvent({
         db: context.db,
         teamId: context.teamId,
         externalId: context.organizationId,
         eventName,
         quantity: 1,
         idempotencyKey: crypto.randomUUID(),
      });
   }),
);

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

describe("billableProcedure smoke", () => {
   it("ingests a usage_events row when a meter is configured", async () => {
      clearMeterCache();
      const { teamId, organizationId } = await seedTeam(testDb.db);

      await testDb.db.insert(meters).values({
         teamId,
         name: "AI classify",
         eventName: "ai.classify",
         aggregation: "sum",
      });

      const proc = billable
         .meta({ billableEvent: "ai.classify" })
         .input(z.object({}))
         .handler(() => ({ ok: true as const }));

      const result = await call(
         proc,
         {},
         { context: { db: testDb.db, teamId, organizationId } },
      );
      expect(result).toEqual({ ok: true });

      const rows = await testDb.db
         .select()
         .from(usageEvents)
         .where(eq(usageEvents.teamId, teamId));
      expect(rows).toHaveLength(1);
   });

   it("no-ops when no meter is configured for the event", async () => {
      clearMeterCache();
      const { teamId, organizationId } = await seedTeam(testDb.db);

      const proc = billable
         .meta({ billableEvent: "no.meter.event" })
         .input(z.object({}))
         .handler(() => ({ ok: true as const }));

      const result = await call(
         proc,
         {},
         { context: { db: testDb.db, teamId, organizationId } },
      );
      expect(result).toEqual({ ok: true });

      const rows = await testDb.db
         .select()
         .from(usageEvents)
         .where(eq(usageEvents.teamId, teamId));
      expect(rows).toHaveLength(0);
   });
});
