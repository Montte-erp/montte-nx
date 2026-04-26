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
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { makeCategory } from "../helpers/classification-factories";
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
});

const SCHEDULED_AT = new Date("2026-04-25T03:00:00.000Z");
const DATE_SUFFIX = "2026-04-25";

describe("backfillKeywordsWorkflow", () => {
   it("empty DB — no startWorkflow calls, no SSE publishes", async () => {
      await backfillKeywordsWorkflow(SCHEDULED_AT, undefined);

      expect(startWorkflowSpy).not.toHaveBeenCalled();
      expect(ssePublishSpy).not.toHaveBeenCalled();
   });

   it("two teams with stale categories — enqueues per-category workflows and emits one SSE per team", async () => {
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
      const teamBCategories = await Promise.all([
         makeCategory(testDb.db, teamB.teamId, {
            name: "Alimentação B",
            keywords: null,
         }),
         makeCategory(testDb.db, teamB.teamId, {
            name: "Combustível B",
            keywords: null,
         }),
      ]);

      await backfillKeywordsWorkflow(SCHEDULED_AT, undefined);

      expect(startWorkflowSpy).toHaveBeenCalledTimes(5);

      const allWorkflowIds = startWorkflowSpy.mock.calls.map(
         (call) => (call[0] as { workflowID: string }).workflowID,
      );
      for (const cat of [...teamACategories, ...teamBCategories]) {
         expect(allWorkflowIds).toContain(
            `derive-category-${cat.id}-${DATE_SUFFIX}`,
         );
      }

      expect(ssePublishSpy).toHaveBeenCalledTimes(2);
      expect(ssePublishSpy).toHaveBeenCalledWith(
         expect.anything(),
         { kind: "team", id: teamA.teamId },
         expect.objectContaining({
            type: "classification.keywords_backfilled",
            payload: { processed: 3 },
         }),
      );
      expect(ssePublishSpy).toHaveBeenCalledWith(
         expect.anything(),
         { kind: "team", id: teamB.teamId },
         expect.objectContaining({
            type: "classification.keywords_backfilled",
            payload: { processed: 2 },
         }),
      );

      const startWorkflowInputs = startWorkflowSpy.mock.calls.map(
         (call) =>
            call[1] as {
               organizationId: string;
               teamId: string;
            },
      );
      const teamAInputs = startWorkflowInputs.filter(
         (i) => i.teamId === teamA.teamId,
      );
      expect(teamAInputs).toHaveLength(3);
      for (const input of teamAInputs) {
         expect(input.organizationId).toBe(teamA.organizationId);
      }
   });
});
