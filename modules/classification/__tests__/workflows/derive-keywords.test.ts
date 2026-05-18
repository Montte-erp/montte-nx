import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import type { Job } from "pg-boss";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { categories } from "@core/database/schemas/categories";
import type { PgBossClient } from "@core/pg-boss/client";
import { makeCategory } from "../helpers/classification-factories";

vi.mock("../../src/ai/derive-keywords", () => ({
   deriveKeywords: vi.fn(),
}));

import { deriveKeywords } from "../../src/ai/derive-keywords";
import {
   deriveKeywordsQueue,
   enqueueDeriveKeywordsJob,
   handleDeriveKeywordsJob,
   type DeriveKeywordsJobInput,
} from "../../src/jobs/derive-keywords-job";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

beforeEach(() => {
   vi.clearAllMocks();
});

const KEYWORDS = ["fast food", "restaurant", "burger", "delivery", "cafe"];

const prompts = {
   get: vi.fn().mockResolvedValue({
      source: "active",
      prompt: "derive keywords",
      name: "montte-derive-keywords",
      version: 1,
   }),
   compile: vi.fn((prompt: string) => prompt),
};

async function getCategory(id: string) {
   const [row] = await testDb.db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
   return row;
}

describe("derive keywords job", () => {
   it("category success — derives keywords and writes keywords + keywordsUpdatedAt", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, { name: "Food" });

      vi.mocked(deriveKeywords).mockReturnValue(
         Promise.resolve(Result.ok(KEYWORDS)) as ReturnType<
            typeof deriveKeywords
         >,
      );

      const result = await handleDeriveKeywordsJob({
         db: testDb.db,
         prompts,
         job: {
            id: "derive-keywords-test",
            data: {
               categoryId: category.id,
               teamId,
               organizationId,
               name: "Food",
               description: null,
            },
         } as Job<DeriveKeywordsJobInput>,
      });

      expect(Result.isOk(result)).toBe(true);
      expect(deriveKeywords).toHaveBeenCalledTimes(1);
      const [, aiInput, observability] =
         vi.mocked(deriveKeywords).mock.calls[0]!;
      expect(aiInput).toMatchObject({
         name: "Food",
         description: null,
      });
      expect(observability).toMatchObject({ distinctId: teamId });

      const after = await getCategory(category.id);
      expect(after?.keywords).toEqual(KEYWORDS);
      expect(after?.keywordsUpdatedAt).toBeInstanceOf(Date);
   });

   it("enqueue dedup — same categoryId uses the same debounced key", async () => {
      const teamId = crypto.randomUUID();
      const organizationId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const sendDebounced = vi.fn().mockResolvedValue("derive-keywords-test");
      const boss = { sendDebounced } as unknown as PgBossClient;

      const input = {
         categoryId,
         teamId,
         organizationId,
         name: "Whatever",
      };

      const first = await enqueueDeriveKeywordsJob({ boss, input });
      const second = await enqueueDeriveKeywordsJob({ boss, input });

      expect(Result.isOk(first)).toBe(true);
      expect(Result.isOk(second)).toBe(true);
      expect(sendDebounced).toHaveBeenCalledTimes(2);
      expect(sendDebounced).toHaveBeenNthCalledWith(
         1,
         deriveKeywordsQueue.name,
         input,
         expect.any(Object),
         expect.any(Number),
         categoryId,
      );
      expect(sendDebounced).toHaveBeenNthCalledWith(
         2,
         deriveKeywordsQueue.name,
         input,
         expect.any(Object),
         expect.any(Number),
         categoryId,
      );
   });

   it("AI failure — job returns error and does not write", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, { name: "Food" });

      vi.mocked(deriveKeywords).mockReturnValue(
         Promise.resolve(Result.err(new Error("AI failed"))) as ReturnType<
            typeof deriveKeywords
         >,
      );

      const result = await handleDeriveKeywordsJob({
         db: testDb.db,
         prompts,
         job: {
            id: "derive-keywords-test",
            data: {
               categoryId: category.id,
               teamId,
               organizationId,
               name: "Food",
            },
         } as Job<DeriveKeywordsJobInput>,
      });

      expect(Result.isError(result)).toBe(true);
      const after = await getCategory(category.id);
      expect(after?.keywords).toBeNull();
   });

   it("dedupes derived keywords against sibling categories", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      await makeCategory(testDb.db, teamId, {
         name: "Sibling",
         keywords: ["burger"],
      });
      const category = await makeCategory(testDb.db, teamId, { name: "Food" });

      vi.mocked(deriveKeywords).mockReturnValue(
         Promise.resolve(Result.ok(KEYWORDS)) as ReturnType<
            typeof deriveKeywords
         >,
      );

      await handleDeriveKeywordsJob({
         db: testDb.db,
         prompts,
         job: {
            id: "derive-keywords-test",
            data: {
               categoryId: category.id,
               teamId,
               organizationId,
               name: "Food",
            },
         } as Job<DeriveKeywordsJobInput>,
      });

      const after = await getCategory(category.id);
      expect(after?.keywords).toEqual(KEYWORDS.filter((k) => k !== "burger"));
      expect(after?.keywords).not.toContain("burger");
   });
});
