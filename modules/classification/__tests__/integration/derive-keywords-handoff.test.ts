import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { ok, okAsync } from "neverthrow";
import { eq } from "drizzle-orm";

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

vi.mock("../../src/ai/derive-keywords", () => ({
   deriveKeywords: vi.fn(),
}));

const { ssePublishSpy } = vi.hoisted(() => ({
   ssePublishSpy: vi.fn(),
}));

vi.mock("../../src/sse", () => ({
   classificationSseEvents: {
      publish: ssePublishSpy,
      eventTypes: [
         "classification.transaction_classified",
         "classification.keywords_derived",
         "classification.keywords_backfilled",
      ],
   },
}));

vi.mock("../../src/workflows/context", async (importOriginal) => {
   const actual =
      await importOriginal<typeof import("../../src/workflows/context")>();
   return {
      ...actual,
      getClassificationRedis: () => ({}),
      getClassificationPosthog: () => ({ capture: vi.fn() }),
   };
});

import { deriveKeywords } from "../../src/ai/derive-keywords";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { categories } from "@core/database/schemas/categories";
import { makeCategory } from "../helpers/classification-factories";
import {
   deriveKeywordsWorkflow,
   enqueueDeriveKeywordsWorkflow,
} from "../../src/workflows/derive-keywords-workflow";
import { CLASSIFICATION_QUEUES } from "../../src/constants";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

beforeEach(async () => {
   vi.clearAllMocks();
   const mocks = await dbosMocks;
   mocks.setActiveDb(testDb.db);
   ssePublishSpy.mockImplementation(
      (
         _redis: unknown,
         scope: { kind: string; id: string },
         event: { type: string; payload: unknown },
      ) =>
         okAsync({
            id: crypto.randomUUID(),
            type: event.type,
            scope,
            payload: event.payload,
            timestamp: new Date().toISOString(),
         }),
   );
});

const KEYWORDS = ["fast food", "restaurant", "burger", "delivery", "cafe"];

describe("deriveKeywords handoff (pglite-backed integration)", () => {
   it("category enqueue → workflow executes → DB write + SSE published", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, {
         name: "Alimentação",
      });

      vi.mocked(deriveKeywords).mockReturnValue(
         Promise.resolve(ok(KEYWORDS)) as unknown as ReturnType<
            typeof deriveKeywords
         >,
      );

      const enqueueCalls: { workflowID?: string; queueName?: string }[] = [];
      const fakeClient = {
         enqueue: vi.fn(
            async (args: { workflowID?: string; queueName?: string }) => {
               enqueueCalls.push(args);
               return undefined;
            },
         ),
      };

      const input = {
         categoryId: category.id,
         teamId,
         organizationId,
         name: "Alimentação",
         description: null,
      };

      // oxlint-ignore no-explicit-any
      await enqueueDeriveKeywordsWorkflow(fakeClient as any, input);

      expect(enqueueCalls).toHaveLength(1);
      expect(enqueueCalls[0]?.workflowID).toBe(
         `derive-category-${category.id}`,
      );
      expect(enqueueCalls[0]?.queueName).toBe(
         `workflow:${CLASSIFICATION_QUEUES.deriveKeywords}`,
      );

      const before = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.id, category.id));
      expect(before[0]?.keywords).toBeNull();

      await deriveKeywordsWorkflow(input);

      const [updated] = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.id, category.id));
      expect(updated?.keywords).toEqual(KEYWORDS);
      expect(updated?.keywordsUpdatedAt).toBeInstanceOf(Date);

      expect(ssePublishSpy).toHaveBeenCalledTimes(1);
      expect(ssePublishSpy).toHaveBeenCalledWith(
         expect.anything(),
         { kind: "team", id: teamId },
         expect.objectContaining({
            type: "classification.keywords_derived",
            payload: expect.objectContaining({
               categoryId: category.id,
               categoryName: "Alimentação",
               count: KEYWORDS.length,
            }),
         }),
      );
   }, 30_000);
});
