import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../../src/testing/setup-test-db";
import { user, organization, team } from "@core/database/schemas/auth";
import * as repo from "../../src/repositories/dashboard-repository";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

async function seedParents() {
   const userId = crypto.randomUUID();
   const organizationId = crypto.randomUUID();
   const teamId = crypto.randomUUID();

   await testDb.db.insert(user).values({
      id: userId,
      name: "Test User",
      email: `${userId}@test.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
   });

   await testDb.db.insert(organization).values({
      id: organizationId,
      name: "Test Org",
      slug: `org-${organizationId}`,
      createdAt: new Date(),
   });

   await testDb.db.insert(team).values({
      id: teamId,
      name: "Test Team",
      slug: `team-${teamId}`,
      organizationId,
      createdAt: new Date(),
   });

   return { organizationId, teamId, userId };
}

function validInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Meu Dashboard",
      ...overrides,
   };
}

describe("dashboard-repository", () => {
   describe("validators", () => {
      it("rejects short name", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         await expect(
            repo.createDashboard(
               testDb.db,
               organizationId,
               teamId,
               userId,
               validInput({ name: "A" }),
            ),
         ).rejects.toMatchObject({ cause: expect.stringMatching(/mínimo/) });
      });

      it("rejects long name", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         await expect(
            repo.createDashboard(
               testDb.db,
               organizationId,
               teamId,
               userId,
               validInput({ name: "A".repeat(121) }),
            ),
         ).rejects.toMatchObject({ cause: expect.stringMatching(/máximo/) });
      });

      it("rejects invalid tile schema", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         await expect(
            repo.createDashboard(
               testDb.db,
               organizationId,
               teamId,
               userId,
               validInput({
                  tiles: [{ insightId: "not-a-uuid", size: "xl", order: -1 }],
               }),
            ),
         ).rejects.toThrow();
      });
   });

   describe("createDashboard", () => {
      it("creates with defaults", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const dashboard = await repo.createDashboard(
            testDb.db,
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         expect(dashboard).toMatchObject({
            organizationId,
            teamId,
            createdBy: userId,
            name: "Meu Dashboard",
            isDefault: false,
            tiles: [],
         });
         expect(dashboard.id).toBeDefined();
      });

      it("creates with tiles", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const insightId = crypto.randomUUID();
         const dashboard = await repo.createDashboard(
            testDb.db,
            organizationId,
            teamId,
            userId,
            validInput({
               tiles: [{ insightId, size: "md", order: 0 }],
            }),
         );

         expect(dashboard.tiles).toHaveLength(1);
         expect(dashboard.tiles[0]).toMatchObject({
            insightId,
            size: "md",
            order: 0,
         });
      });
   });

   describe("listDashboardsByTeam", () => {
      it("lists for team", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         await repo.createDashboard(
            testDb.db,
            organizationId,
            teamId,
            userId,
            validInput({ name: "Dash A" }),
         );
         await repo.createDashboard(
            testDb.db,
            organizationId,
            teamId,
            userId,
            validInput({ name: "Dash B" }),
         );

         const list = await repo.listDashboardsByTeam(testDb.db, teamId);
         expect(list).toHaveLength(2);
      });

      it("isolates between teams", async () => {
         const parentA = await seedParents();
         const parentB = await seedParents();
         await repo.createDashboard(
            testDb.db,
            parentA.organizationId,
            parentA.teamId,
            parentA.userId,
            validInput({ name: "Team A" }),
         );
         await repo.createDashboard(
            testDb.db,
            parentB.organizationId,
            parentB.teamId,
            parentB.userId,
            validInput({ name: "Team B" }),
         );

         const listA = await repo.listDashboardsByTeam(
            testDb.db,
            parentA.teamId,
         );
         expect(listA).toHaveLength(1);
         expect(listA[0]!.name).toBe("Team A");
      });
   });

   describe("getDashboardById", () => {
      it("returns by id", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const created = await repo.createDashboard(
            testDb.db,
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         const found = await repo.getDashboardById(testDb.db, created.id);
         expect(found).toMatchObject({ id: created.id, name: "Meu Dashboard" });
      });

      it("returns null for nonexistent", async () => {
         const found = await repo.getDashboardById(
            testDb.db,
            crypto.randomUUID(),
         );
         expect(found).toBeNull();
      });
   });

   describe("updateDashboard", () => {
      it("updates name and description", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const created = await repo.createDashboard(
            testDb.db,
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         const updated = await repo.updateDashboard(testDb.db, created.id, {
            name: "Novo Nome",
            description: "Nova descrição",
         });

         expect(updated.name).toBe("Novo Nome");
         expect(updated.description).toBe("Nova descrição");
         expect(updated.id).toBe(created.id);
      });
   });

   describe("updateDashboardTiles", () => {
      it("replaces tiles array", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const created = await repo.createDashboard(
            testDb.db,
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         const insightId = crypto.randomUUID();
         const updated = await repo.updateDashboardTiles(
            testDb.db,
            created.id,
            [{ insightId, size: "lg", order: 0 }],
         );

         expect(updated.tiles).toHaveLength(1);
         expect(updated.tiles[0]).toMatchObject({
            insightId,
            size: "lg",
            order: 0,
         });
      });
   });

   describe("deleteDashboard", () => {
      it("deletes a dashboard", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const created = await repo.createDashboard(
            testDb.db,
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         await repo.deleteDashboard(testDb.db, created.id);
         const found = await repo.getDashboardById(testDb.db, created.id);
         expect(found).toBeNull();
      });
   });

   describe("setDashboardAsHome", () => {
      it("sets default and unsets previous", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const dashA = await repo.createDashboard(
            testDb.db,
            organizationId,
            teamId,
            userId,
            validInput({ name: "Dash A" }),
         );
         const dashB = await repo.createDashboard(
            testDb.db,
            organizationId,
            teamId,
            userId,
            validInput({ name: "Dash B" }),
         );

         await repo.setDashboardAsHome(testDb.db, dashA.id, teamId);
         const homeA = await repo.getDashboardById(testDb.db, dashA.id);
         expect(homeA!.isDefault).toBe(true);

         await repo.setDashboardAsHome(testDb.db, dashB.id, teamId);
         const updatedA = await repo.getDashboardById(testDb.db, dashA.id);
         const updatedB = await repo.getDashboardById(testDb.db, dashB.id);
         expect(updatedA!.isDefault).toBe(false);
         expect(updatedB!.isDefault).toBe(true);
      });
   });
});
