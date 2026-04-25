import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { seed } from "drizzle-seed";
import { setupTestDb } from "../../src/testing/setup-test-db";
import * as schema from "@core/database/schema";
import { upsertUsageEventSchema } from "@core/database/schemas/usage-events";
import { meters } from "@core/database/schemas/meters";
import * as repo from "../../src/repositories/usage-events-repository";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomSeed() {
   return Math.floor(Math.random() * 1_000_000);
}

async function seedTeam() {
   const orgId = crypto.randomUUID();
   const teamId = crypto.randomUUID();

   await seed(
      testDb.db,
      { organization: schema.organization },
      { seed: randomSeed() },
   ).refine((f) => ({
      organization: {
         count: 1,
         columns: { id: f.default({ defaultValue: orgId }) },
      },
   }));

   await seed(testDb.db, { team: schema.team }, { seed: randomSeed() }).refine(
      (f) => ({
         team: {
            count: 1,
            columns: {
               id: f.default({ defaultValue: teamId }),
               organizationId: f.default({ defaultValue: orgId }),
            },
         },
      }),
   );

   return teamId;
}

async function seedContact(teamId: string) {
   const contactId = crypto.randomUUID();

   await seed(
      testDb.db,
      { contacts: schema.contacts },
      { seed: randomSeed() },
   ).refine((f) => ({
      contacts: {
         count: 1,
         columns: {
            id: f.default({ defaultValue: contactId }),
            teamId: f.default({ defaultValue: teamId }),
            type: f.default({ defaultValue: "cliente" }),
         },
      },
   }));

   return { id: contactId, teamId };
}

async function seedMeter(teamId: string) {
   const [row] = await testDb.db
      .insert(meters)
      .values({
         teamId,
         name: "API calls",
         eventName: `api.call.${crypto.randomUUID().slice(0, 8)}`,
      })
      .returning();
   return row!.id;
}

function validInput(teamId: string, overrides: Record<string, unknown> = {}) {
   return {
      teamId,
      meterId: crypto.randomUUID(),
      quantity: "10",
      idempotencyKey: crypto.randomUUID(),
      ...overrides,
   };
}

describe("usage-events-repository", () => {
   describe("upsertUsageEventSchema", () => {
      it("accepts valid input", () => {
         const result = upsertUsageEventSchema.safeParse(
            validInput(crypto.randomUUID()),
         );
         expect(result.success).toBe(true);
      });

      it("rejects empty quantity", () => {
         const result = upsertUsageEventSchema.safeParse(
            validInput(crypto.randomUUID(), { quantity: "" }),
         );
         expect(result.success).toBe(false);
      });

      it("rejects non-numeric quantity", () => {
         const result = upsertUsageEventSchema.safeParse(
            validInput(crypto.randomUUID(), { quantity: "abc" }),
         );
         expect(result.success).toBe(false);
      });

      it("rejects negative quantity", () => {
         const result = upsertUsageEventSchema.safeParse(
            validInput(crypto.randomUUID(), { quantity: "-1" }),
         );
         expect(result.success).toBe(false);
      });

      it("rejects Infinity", () => {
         const result = upsertUsageEventSchema.safeParse(
            validInput(crypto.randomUUID(), { quantity: "Infinity" }),
         );
         expect(result.success).toBe(false);
      });

      it("rejects empty idempotencyKey", () => {
         const result = upsertUsageEventSchema.safeParse(
            validInput(crypto.randomUUID(), { idempotencyKey: "" }),
         );
         expect(result.success).toBe(false);
      });

      it("rejects invalid teamId uuid", () => {
         const result = upsertUsageEventSchema.safeParse(
            validInput("not-a-uuid"),
         );
         expect(result.success).toBe(false);
      });

      it("accepts decimal quantity", () => {
         const result = upsertUsageEventSchema.safeParse(
            validInput(crypto.randomUUID(), { quantity: "3.14" }),
         );
         expect(result.success).toBe(true);
      });

      it("accepts zero quantity", () => {
         const result = upsertUsageEventSchema.safeParse(
            validInput(crypto.randomUUID(), { quantity: "0" }),
         );
         expect(result.success).toBe(true);
      });
   });

   describe("upsertUsageEvent", () => {
      it("inserts and returns the event", async () => {
         const teamId = await seedTeam();
         const meterId = await seedMeter(teamId);
         const input = validInput(teamId, { meterId });

         const result = await repo.upsertUsageEvent(testDb.db, input);

         expect(result.isOk()).toBe(true);
         const row = result._unsafeUnwrap();
         expect(row).not.toBeNull();
         expect(row!.teamId).toBe(teamId);
         expect(row!.meterId).toBe(input.meterId);
         expect(Number(row!.quantity)).toBe(10);
         expect(row!.idempotencyKey).toBe(input.idempotencyKey);
      });

      it("returns null on duplicate idempotencyKey — no error", async () => {
         const teamId = await seedTeam();
         const meterId = await seedMeter(teamId);
         const input = validInput(teamId, { meterId });

         await repo.upsertUsageEvent(testDb.db, input);
         const duplicate = await repo.upsertUsageEvent(testDb.db, input);

         expect(duplicate.isOk()).toBe(true);
         expect(duplicate._unsafeUnwrap()).toBeNull();
      });

      it("same idempotencyKey on different team is allowed", async () => {
         const [teamA, teamB] = await Promise.all([seedTeam(), seedTeam()]);
         const [meterA, meterB] = await Promise.all([
            seedMeter(teamA),
            seedMeter(teamB),
         ]);
         const key = crypto.randomUUID();

         const a = await repo.upsertUsageEvent(
            testDb.db,
            validInput(teamA, { idempotencyKey: key, meterId: meterA }),
         );
         const b = await repo.upsertUsageEvent(
            testDb.db,
            validInput(teamB, { idempotencyKey: key, meterId: meterB }),
         );

         expect(a._unsafeUnwrap()).not.toBeNull();
         expect(b._unsafeUnwrap()).not.toBeNull();
      });

      it("stores contactId when provided", async () => {
         const teamId = await seedTeam();
         const meterId = await seedMeter(teamId);
         const contact = await seedContact(teamId);

         const result = await repo.upsertUsageEvent(
            testDb.db,
            validInput(teamId, { contactId: contact.id, meterId }),
         );

         expect(result._unsafeUnwrap()!.contactId).toBe(contact.id);
      });

      it("returns err on invalid input", async () => {
         const result = await repo.upsertUsageEvent(
            testDb.db,
            validInput(crypto.randomUUID(), { quantity: "" }),
         );
         expect(result.isErr()).toBe(true);
      });
   });

   describe("listUsageEventsByContact", () => {
      it("returns only events for that contact", async () => {
         const teamId = await seedTeam();
         const meterId = await seedMeter(teamId);
         const contact = await seedContact(teamId);
         const other = await seedContact(teamId);

         await repo.upsertUsageEvent(
            testDb.db,
            validInput(teamId, { contactId: contact.id, meterId }),
         );
         await repo.upsertUsageEvent(
            testDb.db,
            validInput(teamId, { contactId: other.id, meterId }),
         );

         const result = await repo.listUsageEventsByContact(
            testDb.db,
            teamId,
            contact.id,
         );

         expect(result.isOk()).toBe(true);
         const rows = result._unsafeUnwrap();
         expect(rows).toHaveLength(1);
         expect(rows[0]!.contactId).toBe(contact.id);
      });

      it("returns empty array for contact with no events", async () => {
         const teamId = await seedTeam();
         const contact = await seedContact(teamId);

         const result = await repo.listUsageEventsByContact(
            testDb.db,
            teamId,
            contact.id,
         );

         expect(result._unsafeUnwrap()).toHaveLength(0);
      });
   });

   describe("summarizeUsageByMeter", () => {
      it("sums quantity per meter within period", async () => {
         const teamId = await seedTeam();
         const meterId = await seedMeter(teamId);
         const from = new Date(Date.now() - 60_000);
         const to = new Date(Date.now() + 60_000);

         await repo.upsertUsageEvent(
            testDb.db,
            validInput(teamId, { meterId, quantity: "5" }),
         );
         await repo.upsertUsageEvent(
            testDb.db,
            validInput(teamId, { meterId, quantity: "3" }),
         );

         const result = await repo.summarizeUsageByMeter(testDb.db, teamId, {
            from,
            to,
         });

         expect(result.isOk()).toBe(true);
         const entry = result
            ._unsafeUnwrap()
            .find((s) => s.meterId === meterId);
         expect(entry).toBeDefined();
         expect(Number(entry!.total)).toBeCloseTo(8, 5);
      });

      it("excludes events outside period", async () => {
         const teamId = await seedTeam();
         const meterId = await seedMeter(teamId);

         await repo.upsertUsageEvent(
            testDb.db,
            validInput(teamId, { meterId, quantity: "99" }),
         );

         const result = await repo.summarizeUsageByMeter(testDb.db, teamId, {
            from: new Date("2020-01-01"),
            to: new Date("2020-12-31"),
         });

         const entry = result
            ._unsafeUnwrap()
            .find((s) => s.meterId === meterId);
         expect(entry).toBeUndefined();
      });

      it("returns separate totals per meter", async () => {
         const teamId = await seedTeam();
         const [meterA, meterB] = await Promise.all([
            seedMeter(teamId),
            seedMeter(teamId),
         ]);
         const from = new Date(Date.now() - 60_000);
         const to = new Date(Date.now() + 60_000);

         await repo.upsertUsageEvent(
            testDb.db,
            validInput(teamId, { meterId: meterA, quantity: "10" }),
         );
         await repo.upsertUsageEvent(
            testDb.db,
            validInput(teamId, { meterId: meterB, quantity: "7" }),
         );

         const result = await repo.summarizeUsageByMeter(testDb.db, teamId, {
            from,
            to,
         });

         const summary = result._unsafeUnwrap();
         const a = summary.find((s) => s.meterId === meterA);
         const b = summary.find((s) => s.meterId === meterB);
         expect(Number(a!.total)).toBeCloseTo(10, 5);
         expect(Number(b!.total)).toBeCloseTo(7, 5);
      });

      it("returns empty array when no events in period", async () => {
         const teamId = await seedTeam();

         const result = await repo.summarizeUsageByMeter(testDb.db, teamId, {
            from: new Date("2020-01-01"),
            to: new Date("2020-12-31"),
         });

         expect(result._unsafeUnwrap()).toHaveLength(0);
      });
   });
});
