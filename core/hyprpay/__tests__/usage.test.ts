import {
   afterAll,
   beforeEach,
   beforeAll,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { meters } from "@core/database/schemas/meters";
import { usageEvents } from "@core/database/schemas/usage-events";
import { seedTeam } from "@core/database/testing/factories";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { clearMeterCache, ingestUsageEvent } from "../src/usage";

describe("ingestUsageEvent", () => {
   let db: Awaited<ReturnType<typeof setupTestDb>>["db"];
   let cleanup: () => Promise<void>;
   let teamId: string;
   let orgId: string;

   const eventName = "test.event";

   beforeAll(async () => {
      ({ db, cleanup } = await setupTestDb());
      const seeded = await seedTeam(db);
      teamId = seeded.teamId;
      orgId = seeded.organizationId;
   }, 30_000);

   afterAll(async () => {
      await cleanup();
   });

   beforeEach(async () => {
      clearMeterCache();
      await db.delete(usageEvents);
      await db.delete(meters);
   });

   it("no-ops when no meter is configured for (teamId, eventName)", async () => {
      const result = await ingestUsageEvent({
         db,
         teamId,
         externalId: orgId,
         eventName,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value).toEqual({
            ingested: false,
            reason: "no-meter-configured",
         });
      }

      const rows = await db.select().from(usageEvents);
      expect(rows).toHaveLength(0);
   });

   it("ingests a usage_events row when a meter is configured", async () => {
      const [meter] = await db
         .insert(meters)
         .values({
            teamId,
            name: "Test meter",
            eventName,
            aggregation: "sum",
         })
         .returning();

      const result = await ingestUsageEvent({
         db,
         teamId,
         externalId: orgId,
         eventName,
         quantity: 3,
         idempotencyKey: "key-1",
         properties: { foo: "bar" },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk() && result.value.ingested) {
         expect(result.value.meterId).toBe(meter!.id);
         expect(result.value.idempotencyKey).toBe("key-1");
      }

      const rows = await db
         .select()
         .from(usageEvents)
         .where(eq(usageEvents.idempotencyKey, "key-1"));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.meterId).toBe(meter!.id);
      expect(Number(rows[0]!.quantity)).toBe(3);
   });

   it("respects (teamId, idempotencyKey) uniqueness — repeated key is a no-op insert", async () => {
      await db.insert(meters).values({
         teamId,
         name: "Test meter",
         eventName,
         aggregation: "sum",
      });

      const first = await ingestUsageEvent({
         db,
         teamId,
         externalId: orgId,
         eventName,
         idempotencyKey: "dedup-key",
      });
      expect(first.isOk()).toBe(true);

      const second = await ingestUsageEvent({
         db,
         teamId,
         externalId: orgId,
         eventName,
         idempotencyKey: "dedup-key",
      });
      expect(second.isOk()).toBe(true);

      const rows = await db
         .select()
         .from(usageEvents)
         .where(eq(usageEvents.idempotencyKey, "dedup-key"));
      expect(rows).toHaveLength(1);
   });

   it("caches meter lookups within TTL — repeated calls skip the meters query", async () => {
      await db.insert(meters).values({
         teamId,
         name: "Test meter",
         eventName,
         aggregation: "sum",
      });

      const spy = vi.spyOn(db.query.meters, "findFirst");

      const first = await ingestUsageEvent({
         db,
         teamId,
         externalId: orgId,
         eventName,
         idempotencyKey: "k1",
      });
      expect(first.isOk()).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);

      const second = await ingestUsageEvent({
         db,
         teamId,
         externalId: orgId,
         eventName,
         idempotencyKey: "k2",
      });
      expect(second.isOk()).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);

      clearMeterCache();
      const third = await ingestUsageEvent({
         db,
         teamId,
         externalId: orgId,
         eventName,
         idempotencyKey: "k3",
      });
      expect(third.isOk()).toBe(true);
      expect(spy).toHaveBeenCalledTimes(2);

      spy.mockRestore();
   });

   it("isolates meters by teamId — meter for team A does not match team B", async () => {
      const other = await seedTeam(db);
      await db.insert(meters).values({
         teamId: other.teamId,
         name: "Other meter",
         eventName,
         aggregation: "sum",
      });

      const result = await ingestUsageEvent({
         db,
         teamId,
         externalId: orgId,
         eventName,
         idempotencyKey: "k",
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value.ingested).toBe(false);
      }
   });
});
