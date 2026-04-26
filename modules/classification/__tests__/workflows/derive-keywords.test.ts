import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { ok, errAsync } from "neverthrow";

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

vi.mock("../../src/ai/derive-keywords", () => ({
   deriveKeywords: vi.fn(),
}));

vi.mock("@packages/events/credits", () => ({
   enforceCreditBudget: vi.fn(),
}));

vi.mock("@packages/events/ai", () => ({
   emitAiKeywordDerived: vi.fn().mockResolvedValue(undefined),
   emitAiTagKeywordDerived: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@packages/events/emit", () => ({
   createEmitFn: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
}));

import { deriveKeywords } from "../../src/ai/derive-keywords";
import { enforceCreditBudget } from "@packages/events/credits";
import {
   emitAiKeywordDerived,
   emitAiTagKeywordDerived,
} from "@packages/events/ai";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { makeCategory, makeTag } from "../helpers/classification-factories";
import {
   deriveKeywordsWorkflow,
   enqueueDeriveKeywordsWorkflow,
} from "../../src/workflows/derive-keywords-workflow";

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
   vi.mocked(enforceCreditBudget).mockResolvedValue(undefined);
});

const KEYWORDS = ["fast food", "restaurant", "burger", "delivery", "cafe"];

async function getCategory(id: string) {
   const [row] = await testDb.db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
   return row;
}

async function getTag(id: string) {
   const [row] = await testDb.db.select().from(tags).where(eq(tags.id, id));
   return row;
}

describe("deriveKeywordsWorkflow", () => {
   it("budget exceeded — throws, no AI call, no DB write, no SSE, no billing emit", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, {
         name: "Alimentação",
      });

      vi.mocked(enforceCreditBudget).mockRejectedValueOnce(
         new Error("Free tier limit exceeded for ai.keyword_derived"),
      );

      await expect(
         deriveKeywordsWorkflow({
            entity: "category",
            categoryId: category.id,
            teamId,
            organizationId,
            name: category.name,
         }),
      ).rejects.toThrow();

      expect(deriveKeywords).not.toHaveBeenCalled();

      const after = await getCategory(category.id);
      expect(after?.keywords).toBeNull();
      expect(after?.keywordsUpdatedAt).toBeNull();

      expect(ssePublishSpy).not.toHaveBeenCalled();
      expect(emitAiKeywordDerived).not.toHaveBeenCalled();
   });

   it("category success — derives keywords, writes keywords + keywordsUpdatedAt, emits billing + SSE", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, { name: "Food" });

      vi.mocked(deriveKeywords).mockReturnValue(
         Promise.resolve(ok(KEYWORDS)) as unknown as ReturnType<
            typeof deriveKeywords
         >,
      );

      await deriveKeywordsWorkflow({
         entity: "category",
         categoryId: category.id,
         teamId,
         organizationId,
         name: "Food",
         description: null,
      });

      expect(deriveKeywords).toHaveBeenCalledTimes(1);
      const [aiInput, observability] = vi.mocked(deriveKeywords).mock.calls[0]!;
      expect(aiInput).toEqual({
         entity: "category",
         name: "Food",
         description: null,
      });
      expect(observability).toMatchObject({ distinctId: teamId });

      const after = await getCategory(category.id);
      expect(after?.keywords).toEqual(KEYWORDS);
      expect(after?.keywordsUpdatedAt).toBeInstanceOf(Date);

      expect(ssePublishSpy).toHaveBeenCalledTimes(1);
      expect(ssePublishSpy).toHaveBeenCalledWith(
         expect.anything(),
         { kind: "team", id: teamId },
         expect.objectContaining({
            type: "classification.keywords_derived",
            payload: {
               entity: "category",
               entityId: category.id,
               entityName: "Food",
               count: KEYWORDS.length,
            },
         }),
      );

      expect(emitAiKeywordDerived).toHaveBeenCalledTimes(1);
      const [, billingCtx, billingProps] =
         vi.mocked(emitAiKeywordDerived).mock.calls[0]!;
      expect(billingCtx).toMatchObject({ organizationId, teamId });
      expect(billingProps).toMatchObject({
         categoryId: category.id,
         keywordCount: KEYWORDS.length,
         model: "deepseek/deepseek-v4-pro",
         latencyMs: 0,
      });
      expect(emitAiTagKeywordDerived).not.toHaveBeenCalled();
   });

   it("tag success — writes only keywords (no keywordsUpdatedAt column on tags), emits tag billing + SSE", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const tag = await makeTag(testDb.db, teamId, { name: "Marketing" });

      vi.mocked(deriveKeywords).mockReturnValue(
         Promise.resolve(ok(KEYWORDS)) as unknown as ReturnType<
            typeof deriveKeywords
         >,
      );

      await deriveKeywordsWorkflow({
         entity: "tag",
         tagId: tag.id,
         teamId,
         organizationId,
         name: "Marketing",
         description: "Centro de custo de marketing",
      });

      expect(deriveKeywords).toHaveBeenCalledWith(
         {
            entity: "tag",
            name: "Marketing",
            description: "Centro de custo de marketing",
         },
         expect.objectContaining({ distinctId: teamId }),
      );

      const after = await getTag(tag.id);
      expect(after?.keywords).toEqual(KEYWORDS);

      expect(ssePublishSpy).toHaveBeenCalledTimes(1);
      expect(ssePublishSpy).toHaveBeenCalledWith(
         expect.anything(),
         { kind: "team", id: teamId },
         expect.objectContaining({
            type: "classification.keywords_derived",
            payload: {
               entity: "tag",
               entityId: tag.id,
               entityName: "Marketing",
               count: KEYWORDS.length,
            },
         }),
      );

      expect(emitAiTagKeywordDerived).toHaveBeenCalledTimes(1);
      const [, billingCtx, billingProps] = vi.mocked(emitAiTagKeywordDerived)
         .mock.calls[0]!;
      expect(billingCtx).toMatchObject({ organizationId, teamId });
      expect(billingProps).toMatchObject({
         tagId: tag.id,
         keywordCount: KEYWORDS.length,
         model: "deepseek/deepseek-v4-pro",
         latencyMs: 0,
      });
      expect(emitAiKeywordDerived).not.toHaveBeenCalled();
   });

   it("workflow ID dedup — same input produces same workflowID across enqueues", async () => {
      const teamId = crypto.randomUUID();
      const organizationId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

      const enqueueCalls: { workflowID?: string }[] = [];
      const fakeClient = {
         enqueue: vi.fn(async (args: { workflowID?: string }) => {
            enqueueCalls.push(args);
            return undefined;
         }),
      };

      const input = {
         entity: "category" as const,
         categoryId,
         teamId,
         organizationId,
         name: "Whatever",
      };

      // oxlint-ignore no-explicit-any
      await enqueueDeriveKeywordsWorkflow(fakeClient as any, input);
      // oxlint-ignore no-explicit-any
      await enqueueDeriveKeywordsWorkflow(fakeClient as any, input);

      expect(enqueueCalls).toHaveLength(2);
      expect(enqueueCalls[0]?.workflowID).toBe(`derive-category-${categoryId}`);
      expect(enqueueCalls[1]?.workflowID).toBe(`derive-category-${categoryId}`);

      // Tag side
      const tagId = crypto.randomUUID();
      const tagInput = {
         entity: "tag" as const,
         tagId,
         teamId,
         organizationId,
         name: "Whatever",
      };
      // oxlint-ignore no-explicit-any
      await enqueueDeriveKeywordsWorkflow(fakeClient as any, tagInput);
      expect(enqueueCalls[2]?.workflowID).toBe(`derive-tag-${tagId}`);
   });

   it("AI failure — workflow throws, no DB write, no SSE, no billing emit", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, { name: "Food" });

      vi.mocked(deriveKeywords).mockReturnValue(
         errAsync(new Error("AI failed")) as unknown as ReturnType<
            typeof deriveKeywords
         >,
      );

      await expect(
         deriveKeywordsWorkflow({
            entity: "category",
            categoryId: category.id,
            teamId,
            organizationId,
            name: "Food",
         }),
      ).rejects.toThrow();

      const after = await getCategory(category.id);
      expect(after?.keywords).toBeNull();
      expect(ssePublishSpy).not.toHaveBeenCalled();
      expect(emitAiKeywordDerived).not.toHaveBeenCalled();
   });
});
