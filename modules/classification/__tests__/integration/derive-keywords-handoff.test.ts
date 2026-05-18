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

describe("deriveKeywords handoff (pglite-backed integration)", () => {
   it("category enqueue → pg-boss handler executes → DB write", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, {
         name: "Alimentação",
      });

      vi.mocked(deriveKeywords).mockReturnValue(
         Promise.resolve(Result.ok(KEYWORDS)) as ReturnType<
            typeof deriveKeywords
         >,
      );

      const sendDebounced = vi.fn().mockResolvedValue("derive-keywords-test");
      const boss = { sendDebounced } as unknown as PgBossClient;

      const input = {
         categoryId: category.id,
         teamId,
         organizationId,
         name: "Alimentação",
         description: null,
      };

      const queued = await enqueueDeriveKeywordsJob({ boss, input });

      expect(Result.isOk(queued)).toBe(true);
      expect(sendDebounced).toHaveBeenCalledTimes(1);
      expect(sendDebounced).toHaveBeenCalledWith(
         deriveKeywordsQueue.name,
         input,
         expect.any(Object),
         expect.any(Number),
         category.id,
      );

      const before = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.id, category.id));
      expect(before[0]?.keywords).toBeNull();

      const handled = await handleDeriveKeywordsJob({
         db: testDb.db,
         prompts,
         job: {
            id: "derive-keywords-test",
            data: input,
         } as Job<DeriveKeywordsJobInput>,
      });

      expect(Result.isOk(handled)).toBe(true);
      const [updated] = await testDb.db
         .select()
         .from(categories)
         .where(eq(categories.id, category.id));
      expect(updated?.keywords).toEqual(KEYWORDS);
      expect(updated?.keywordsUpdatedAt).toBeInstanceOf(Date);
   }, 30_000);
});
