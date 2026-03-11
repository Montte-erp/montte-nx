import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { user, organization, team } from "@core/database/schemas/auth";
import * as repo from "../../src/repositories/insight-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

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
      name: "Meu Insight",
      type: "trends" as const,
      config: { events: ["page_view"], interval: "day" },
      ...overrides,
   };
}

describe("insight-repository", () => {
   describe("validators", () => {
      it("rejects short name", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         await expect(
            repo.createInsight(
               organizationId,
               teamId,
               userId,
               validInput({ name: "A" }),
            ),
         ).rejects.toThrow(/validation failed/);
      });

      it("rejects invalid type", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         await expect(
            repo.createInsight(
               organizationId,
               teamId,
               userId,
               validInput({ type: "invalid" }),
            ),
         ).rejects.toThrow(/validation failed/);
      });
   });

   describe("createInsight", () => {
      it("creates with defaults", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const insight = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         expect(insight).toMatchObject({
            organizationId,
            teamId,
            createdBy: userId,
            name: "Meu Insight",
            type: "trends",
            defaultSize: "md",
         });
         expect(insight.id).toBeDefined();
      });

      it("stores config correctly", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const config = { events: ["page_view"], interval: "day" };
         const insight = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ config }),
         );

         expect(insight.config).toEqual(config);
      });
   });

   describe("listInsightsByTeam", () => {
      it("lists for team", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "Insight A" }),
         );
         await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "Insight B" }),
         );

         const list = await repo.listInsightsByTeam(teamId);
         expect(list).toHaveLength(2);
      });

      it("filters by type", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ type: "trends" }),
         );
         await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "Funil", type: "funnels" }),
         );

         const list = await repo.listInsightsByTeam(teamId, "funnels");
         expect(list).toHaveLength(1);
         expect(list[0]!.type).toBe("funnels");
      });
   });

   describe("getInsightById", () => {
      it("returns by id", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const created = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         const found = await repo.getInsightById(created.id);
         expect(found).toMatchObject({ id: created.id, name: "Meu Insight" });
      });

      it("returns null for nonexistent", async () => {
         const found = await repo.getInsightById(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("getInsightsByIds", () => {
      it("returns multiple", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const a = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "AA" }),
         );
         const b = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "BB" }),
         );

         const found = await repo.getInsightsByIds([a.id, b.id]);
         expect(found).toHaveLength(2);
      });

      it("returns empty for empty array", async () => {
         const found = await repo.getInsightsByIds([]);
         expect(found).toEqual([]);
      });
   });

   describe("updateInsight", () => {
      it("updates name and config", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const created = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         const updated = await repo.updateInsight(created.id, {
            name: "Novo Nome",
            config: { events: ["click"], interval: "week" },
         });

         expect(updated.name).toBe("Novo Nome");
         expect(updated.config).toEqual({
            events: ["click"],
            interval: "week",
         });
         expect(updated.id).toBe(created.id);
      });
   });

   describe("deleteInsight", () => {
      it("deletes", async () => {
         const { organizationId, teamId, userId } = await seedParents();
         const created = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         await repo.deleteInsight(created.id);
         const found = await repo.getInsightById(created.id);
         expect(found).toBeNull();
      });
   });
});
