import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { seed } from "drizzle-seed";
import { setupTestDb } from "../../src/testing/setup-test-db";
import * as schema from "@core/database/schema";
import * as repo from "../../src/repositories/meters-repository";

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

function validMeterInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Consultas API",
      eventName: `api.call.${crypto.randomUUID()}`,
      aggregation: "sum" as const,
      ...overrides,
   };
}

describe("meters-repository", () => {
   describe("createMeter", () => {
      it("creates meter with correct fields", async () => {
         const teamId = await seedTeam();
         const result = await repo.createMeter(
            testDb.db,
            teamId,
            validMeterInput({ name: "Meu Medidor" }),
         );
         const meter = result._unsafeUnwrap();
         expect(meter).toMatchObject({
            teamId,
            name: "Meu Medidor",
            isActive: true,
         });
         expect(meter.id).toBeDefined();
      });

      it("rejects name shorter than 2 chars", async () => {
         const teamId = await seedTeam();
         const result = await repo.createMeter(
            testDb.db,
            teamId,
            validMeterInput({ name: "A" }),
         );
         expect(result.isErr()).toBe(true);
      });

      it("rejects duplicate eventName on same team", async () => {
         const teamId = await seedTeam();
         const eventName = `event.${crypto.randomUUID()}`;
         await repo.createMeter(
            testDb.db,
            teamId,
            validMeterInput({ eventName }),
         );
         const dup = await repo.createMeter(
            testDb.db,
            teamId,
            validMeterInput({ eventName }),
         );
         expect(dup.isErr()).toBe(true);
      });

      it("allows same eventName on different teams", async () => {
         const [teamA, teamB] = await Promise.all([seedTeam(), seedTeam()]);
         const eventName = `shared.${crypto.randomUUID()}`;
         const a = await repo.createMeter(
            testDb.db,
            teamA,
            validMeterInput({ eventName }),
         );
         const b = await repo.createMeter(
            testDb.db,
            teamB,
            validMeterInput({ eventName }),
         );
         expect(a.isOk()).toBe(true);
         expect(b.isOk()).toBe(true);
      });
   });

   describe("getMeter", () => {
      it("returns meter by id", async () => {
         const teamId = await seedTeam();
         const created = (
            await repo.createMeter(testDb.db, teamId, validMeterInput())
         )._unsafeUnwrap();
         const found = (
            await repo.getMeter(testDb.db, created.id)
         )._unsafeUnwrap();
         expect(found?.id).toBe(created.id);
      });

      it("returns null for non-existent id", async () => {
         expect(
            (
               await repo.getMeter(testDb.db, crypto.randomUUID())
            )._unsafeUnwrap(),
         ).toBeNull();
      });
   });

   describe("listMeters", () => {
      it("lists meters for team only", async () => {
         const [teamA, teamB] = await Promise.all([seedTeam(), seedTeam()]);
         await repo.createMeter(testDb.db, teamA, validMeterInput());
         await repo.createMeter(testDb.db, teamB, validMeterInput());
         const list = (await repo.listMeters(testDb.db, teamA))._unsafeUnwrap();
         expect(list.every((m) => m.teamId === teamA)).toBe(true);
      });
   });

   describe("updateMeter", () => {
      it("updates name", async () => {
         const teamId = await seedTeam();
         const created = (
            await repo.createMeter(testDb.db, teamId, validMeterInput())
         )._unsafeUnwrap();
         const updated = (
            await repo.updateMeter(testDb.db, created.id, { name: "Novo Nome" })
         )._unsafeUnwrap();
         expect(updated.name).toBe("Novo Nome");
      });

      it("returns err for non-existent id", async () => {
         const result = await repo.updateMeter(testDb.db, crypto.randomUUID(), {
            name: "Xx Yy",
         });
         expect(result.isErr()).toBe(true);
      });
   });

   describe("deleteMeter", () => {
      it("deletes a meter", async () => {
         const teamId = await seedTeam();
         const created = (
            await repo.createMeter(testDb.db, teamId, validMeterInput())
         )._unsafeUnwrap();
         await repo.deleteMeter(testDb.db, created.id);
         expect(
            (await repo.getMeter(testDb.db, created.id))._unsafeUnwrap(),
         ).toBeNull();
      });
   });

   describe("ensureMeterOwnership", () => {
      it("returns meter when team matches", async () => {
         const teamId = await seedTeam();
         const created = (
            await repo.createMeter(testDb.db, teamId, validMeterInput())
         )._unsafeUnwrap();
         expect(
            (
               await repo.ensureMeterOwnership(testDb.db, created.id, teamId)
            ).isOk(),
         ).toBe(true);
      });

      it("returns err when team does not match", async () => {
         const teamId = await seedTeam();
         const created = (
            await repo.createMeter(testDb.db, teamId, validMeterInput())
         )._unsafeUnwrap();
         expect(
            (
               await repo.ensureMeterOwnership(
                  testDb.db,
                  created.id,
                  crypto.randomUUID(),
               )
            ).isErr(),
         ).toBe(true);
      });
   });
});
