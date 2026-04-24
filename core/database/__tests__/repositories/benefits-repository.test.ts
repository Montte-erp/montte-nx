import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { seed } from "drizzle-seed";
import { setupTestDb } from "../../src/testing/setup-test-db";
import * as schema from "@core/database/schema";
import { services } from "@core/database/schemas/services";
import * as repo from "../../src/repositories/benefits-repository";

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

async function seedService(teamId: string) {
   const [svc] = await testDb.db
      .insert(services)
      .values({ teamId, name: "Plano Premium" })
      .returning();
   return svc!;
}

function validBenefitInput(overrides: Record<string, unknown> = {}) {
   return { name: "Acesso VIP", type: "feature_access" as const, ...overrides };
}

describe("benefits-repository", () => {
   describe("createBenefit", () => {
      it("creates benefit with correct fields", async () => {
         const teamId = await seedTeam();
         const benefit = (
            await repo.createBenefit(testDb.db, teamId, validBenefitInput())
         )._unsafeUnwrap();
         expect(benefit).toMatchObject({
            teamId,
            name: "Acesso VIP",
            type: "feature_access",
            isActive: true,
         });
      });

      it("rejects name shorter than 2 chars", async () => {
         const teamId = await seedTeam();
         expect(
            (
               await repo.createBenefit(
                  testDb.db,
                  teamId,
                  validBenefitInput({ name: "X" }),
               )
            ).isErr(),
         ).toBe(true);
      });
   });

   describe("getBenefit", () => {
      it("returns benefit by id", async () => {
         const teamId = await seedTeam();
         const created = (
            await repo.createBenefit(testDb.db, teamId, validBenefitInput())
         )._unsafeUnwrap();
         expect(
            (await repo.getBenefit(testDb.db, created.id))._unsafeUnwrap()?.id,
         ).toBe(created.id);
      });

      it("returns null for non-existent id", async () => {
         expect(
            (
               await repo.getBenefit(testDb.db, crypto.randomUUID())
            )._unsafeUnwrap(),
         ).toBeNull();
      });
   });

   describe("updateBenefit", () => {
      it("updates name and isActive", async () => {
         const teamId = await seedTeam();
         const created = (
            await repo.createBenefit(testDb.db, teamId, validBenefitInput())
         )._unsafeUnwrap();
         const updated = (
            await repo.updateBenefit(testDb.db, created.id, {
               name: "Acesso Ouro",
               isActive: false,
            })
         )._unsafeUnwrap();
         expect(updated.name).toBe("Acesso Ouro");
         expect(updated.isActive).toBe(false);
      });
   });

   describe("deleteBenefit", () => {
      it("deletes a benefit", async () => {
         const teamId = await seedTeam();
         const created = (
            await repo.createBenefit(testDb.db, teamId, validBenefitInput())
         )._unsafeUnwrap();
         await repo.deleteBenefit(testDb.db, created.id);
         expect(
            (await repo.getBenefit(testDb.db, created.id))._unsafeUnwrap(),
         ).toBeNull();
      });
   });

   describe("attachBenefitToService / detachBenefitFromService / listBenefitsByService", () => {
      it("attaches and lists", async () => {
         const teamId = await seedTeam();
         const svc = await seedService(teamId);
         const benefit = (
            await repo.createBenefit(testDb.db, teamId, validBenefitInput())
         )._unsafeUnwrap();
         await repo.attachBenefitToService(testDb.db, svc.id, benefit.id);
         const list = (
            await repo.listBenefitsByService(testDb.db, svc.id)
         )._unsafeUnwrap();
         expect(list).toHaveLength(1);
         expect(list[0]!.id).toBe(benefit.id);
      });

      it("attach is idempotent", async () => {
         const teamId = await seedTeam();
         const svc = await seedService(teamId);
         const benefit = (
            await repo.createBenefit(testDb.db, teamId, validBenefitInput())
         )._unsafeUnwrap();
         await repo.attachBenefitToService(testDb.db, svc.id, benefit.id);
         await repo.attachBenefitToService(testDb.db, svc.id, benefit.id);
         expect(
            (
               await repo.listBenefitsByService(testDb.db, svc.id)
            )._unsafeUnwrap(),
         ).toHaveLength(1);
      });

      it("detaches benefit", async () => {
         const teamId = await seedTeam();
         const svc = await seedService(teamId);
         const benefit = (
            await repo.createBenefit(testDb.db, teamId, validBenefitInput())
         )._unsafeUnwrap();
         await repo.attachBenefitToService(testDb.db, svc.id, benefit.id);
         await repo.detachBenefitFromService(testDb.db, svc.id, benefit.id);
         expect(
            (
               await repo.listBenefitsByService(testDb.db, svc.id)
            )._unsafeUnwrap(),
         ).toHaveLength(0);
      });

      it("returns empty for service with no benefits", async () => {
         const teamId = await seedTeam();
         const svc = await seedService(teamId);
         expect(
            (
               await repo.listBenefitsByService(testDb.db, svc.id)
            )._unsafeUnwrap(),
         ).toHaveLength(0);
      });
   });

   describe("ensureBenefitOwnership", () => {
      it("returns err when team does not match", async () => {
         const teamId = await seedTeam();
         const created = (
            await repo.createBenefit(testDb.db, teamId, validBenefitInput())
         )._unsafeUnwrap();
         expect(
            (
               await repo.ensureBenefitOwnership(
                  testDb.db,
                  created.id,
                  crypto.randomUUID(),
               )
            ).isErr(),
         ).toBe(true);
      });
   });
});
