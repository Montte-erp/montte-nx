import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

const dbosMocks = vi.hoisted(async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.createDbosMocks();
});

vi.mock("@dbos-inc/dbos-sdk", async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.dbosSdkMockFactory(await dbosMocks);
});

vi.mock("@dbos-inc/drizzle-datasource", async () => {
   const mod = await import("@core/dbos/testing/mock-dbos");
   return mod.drizzleDataSourceMockFactory(await dbosMocks);
});

import { ssePublishSpy } from "../helpers/mock-classification-context";

vi.mock("@packages/events/credits", () => ({
   enforceCreditBudget: vi.fn(),
}));

import { enforceCreditBudget } from "@packages/events/credits";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { makeCategory, makeTag } from "../helpers/classification-factories";
import { backfillKeywordsWorkflow } from "../../src/workflows/backfill-keywords-workflow";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;
let startWorkflowSpy: Awaited<typeof dbosMocks>["startWorkflowSpy"];

beforeAll(async () => {
   testDb = await setupTestDb();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
   startWorkflowSpy = mocks.startWorkflowSpy;
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

beforeEach(async () => {
   vi.clearAllMocks();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
   vi.mocked(enforceCreditBudget).mockResolvedValue(undefined);
});

const SCHEDULED_AT = new Date("2026-04-25T03:00:00.000Z");
const DATE_SUFFIX = "2026-04-25";

describe("backfillKeywordsWorkflow", () => {
   it("empty DB — no startWorkflow calls, no SSE publishes", async () => {
      await backfillKeywordsWorkflow(SCHEDULED_AT, undefined);

      expect(startWorkflowSpy).not.toHaveBeenCalled();
      expect(ssePublishSpy).not.toHaveBeenCalled();
   });

   it("two teams, full backfill — enqueues per-entity workflows and emits one SSE per entity-kind per team", async () => {
      const teamA = await seedTeam(testDb.db);
      const teamB = await seedTeam(testDb.db);

      const teamACategories = await Promise.all([
         makeCategory(testDb.db, teamA.teamId, {
            name: "Alimentação A",
            keywords: null,
         }),
         makeCategory(testDb.db, teamA.teamId, {
            name: "Combustível A",
            keywords: null,
         }),
         makeCategory(testDb.db, teamA.teamId, {
            name: "Marketing A",
            keywords: null,
         }),
      ]);
      const teamATags = await Promise.all([
         makeTag(testDb.db, teamA.teamId, {
            name: "Centro A1",
            keywords: null,
         }),
         makeTag(testDb.db, teamA.teamId, {
            name: "Centro A2",
            keywords: null,
         }),
      ]);

      const teamBCategories = await Promise.all([
         makeCategory(testDb.db, teamB.teamId, {
            name: "Alimentação B",
            keywords: null,
         }),
         makeCategory(testDb.db, teamB.teamId, {
            name: "Combustível B",
            keywords: null,
         }),
         makeCategory(testDb.db, teamB.teamId, {
            name: "Marketing B",
            keywords: null,
         }),
      ]);
      const teamBTags = await Promise.all([
         makeTag(testDb.db, teamB.teamId, {
            name: "Centro B1",
            keywords: null,
         }),
         makeTag(testDb.db, teamB.teamId, {
            name: "Centro B2",
            keywords: null,
         }),
      ]);

      await backfillKeywordsWorkflow(SCHEDULED_AT, undefined);

      expect(startWorkflowSpy).toHaveBeenCalledTimes(10);

      const allWorkflowIds = startWorkflowSpy.mock.calls.map(
         (call) => (call[0] as { workflowID: string }).workflowID,
      );
      for (const cat of [...teamACategories, ...teamBCategories]) {
         expect(allWorkflowIds).toContain(
            `derive-category-${cat.id}-${DATE_SUFFIX}`,
         );
      }
      for (const tag of [...teamATags, ...teamBTags]) {
         expect(allWorkflowIds).toContain(
            `derive-tag-${tag.id}-${DATE_SUFFIX}`,
         );
      }

      expect(ssePublishSpy).toHaveBeenCalledTimes(4);
      expect(ssePublishSpy).toHaveBeenCalledWith(
         expect.anything(),
         { kind: "team", id: teamA.teamId },
         expect.objectContaining({
            type: "classification.keywords_backfilled",
            payload: { entity: "category", processed: 3 },
         }),
      );
      expect(ssePublishSpy).toHaveBeenCalledWith(
         expect.anything(),
         { kind: "team", id: teamA.teamId },
         expect.objectContaining({
            type: "classification.keywords_backfilled",
            payload: { entity: "tag", processed: 2 },
         }),
      );
      expect(ssePublishSpy).toHaveBeenCalledWith(
         expect.anything(),
         { kind: "team", id: teamB.teamId },
         expect.objectContaining({
            type: "classification.keywords_backfilled",
            payload: { entity: "category", processed: 3 },
         }),
      );
      expect(ssePublishSpy).toHaveBeenCalledWith(
         expect.anything(),
         { kind: "team", id: teamB.teamId },
         expect.objectContaining({
            type: "classification.keywords_backfilled",
            payload: { entity: "tag", processed: 2 },
         }),
      );

      const startWorkflowInputs = startWorkflowSpy.mock.calls.map(
         (call) =>
            call[1] as {
               entity: string;
               organizationId: string;
               teamId: string;
            },
      );
      const teamACategoryInputs = startWorkflowInputs.filter(
         (i) => i.entity === "category" && i.teamId === teamA.teamId,
      );
      expect(teamACategoryInputs).toHaveLength(3);
      for (const input of teamACategoryInputs) {
         expect(input.organizationId).toBe(teamA.organizationId);
      }
   });

   it("budget exceeded mid-team — bails categories partway, still processes tags and other team", async () => {
      const teamA = await seedTeam(testDb.db);
      const teamB = await seedTeam(testDb.db);

      const teamACategories = await Promise.all([
         makeCategory(testDb.db, teamA.teamId, {
            name: "Cat A1",
            keywords: null,
         }),
         makeCategory(testDb.db, teamA.teamId, {
            name: "Cat A2",
            keywords: null,
         }),
         makeCategory(testDb.db, teamA.teamId, {
            name: "Cat A3",
            keywords: null,
         }),
      ]);
      await Promise.all([
         makeTag(testDb.db, teamA.teamId, { name: "Tag A1", keywords: null }),
         makeTag(testDb.db, teamA.teamId, { name: "Tag A2", keywords: null }),
      ]);
      await Promise.all([
         makeCategory(testDb.db, teamB.teamId, {
            name: "Cat B1",
            keywords: null,
         }),
         makeCategory(testDb.db, teamB.teamId, {
            name: "Cat B2",
            keywords: null,
         }),
         makeCategory(testDb.db, teamB.teamId, {
            name: "Cat B3",
            keywords: null,
         }),
      ]);
      await Promise.all([
         makeTag(testDb.db, teamB.teamId, { name: "Tag B1", keywords: null }),
         makeTag(testDb.db, teamB.teamId, { name: "Tag B2", keywords: null }),
      ]);

      const teamACategoryIds = new Set(teamACategories.map((c) => c.id));
      let teamACategoryEnforcementCount = 0;
      vi.mocked(enforceCreditBudget).mockImplementation(
         async (organizationId: string, eventName: string) => {
            if (
               organizationId === teamA.organizationId &&
               eventName === "ai.keyword_derived"
            ) {
               teamACategoryEnforcementCount++;
               if (teamACategoryEnforcementCount === 2) {
                  throw new Error(
                     "Free tier limit exceeded for ai.keyword_derived",
                  );
               }
            }
            return undefined;
         },
      );

      await backfillKeywordsWorkflow(SCHEDULED_AT, undefined);

      const calls = startWorkflowSpy.mock.calls.map(
         (call) =>
            call[1] as {
               entity: "category" | "tag";
               teamId: string;
            },
      );

      const teamACategoryCalls = calls.filter(
         (c) => c.entity === "category" && c.teamId === teamA.teamId,
      );
      expect(teamACategoryCalls).toHaveLength(1);

      const teamATagCalls = calls.filter(
         (c) => c.entity === "tag" && c.teamId === teamA.teamId,
      );
      expect(teamATagCalls).toHaveLength(2);

      const teamBCategoryCalls = calls.filter(
         (c) => c.entity === "category" && c.teamId === teamB.teamId,
      );
      expect(teamBCategoryCalls).toHaveLength(3);

      const teamBTagCalls = calls.filter(
         (c) => c.entity === "tag" && c.teamId === teamB.teamId,
      );
      expect(teamBTagCalls).toHaveLength(2);

      const ssePublishes = ssePublishSpy.mock.calls.map((call) => ({
         scope: call[1] as { kind: string; id: string },
         payload: (
            call[2] as { payload: { entity: string; processed: number } }
         ).payload,
      }));

      const teamACategorySse = ssePublishes.filter(
         (p) => p.scope.id === teamA.teamId && p.payload.entity === "category",
      );
      expect(teamACategorySse).toHaveLength(1);
      expect(teamACategorySse[0]?.payload.processed).toBe(1);

      const teamATagSse = ssePublishes.filter(
         (p) => p.scope.id === teamA.teamId && p.payload.entity === "tag",
      );
      expect(teamATagSse).toHaveLength(1);
      expect(teamATagSse[0]?.payload.processed).toBe(2);

      const teamBSse = ssePublishes.filter((p) => p.scope.id === teamB.teamId);
      expect(teamBSse).toHaveLength(2);

      expect(teamACategoryIds).toBeDefined();
   });
});
