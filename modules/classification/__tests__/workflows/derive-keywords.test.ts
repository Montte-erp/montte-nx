import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { LLMock } from "@copilotkit/aimock";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import type { Job } from "pg-boss";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { categories } from "@core/database/schemas/categories";
import type { PgBossClient } from "@core/pg-boss/client";
import { makeCategory } from "../helpers/classification-factories";
import type { DeriveKeywordsJobInput } from "../../src/jobs/derive-keywords-job";

type DeriveKeywordsJobModule =
   typeof import("../../src/jobs/derive-keywords-job");

const llmMock = new LLMock({ port: 0 });
let testDb: Awaited<ReturnType<typeof setupTestDb>>;
let deriveKeywordsJob: DeriveKeywordsJobModule;

beforeAll(async () => {
   const url = await llmMock.start();
   process.env.OPENROUTER_BASE_URL = `${url}/v1`;
   deriveKeywordsJob = await import("../../src/jobs/derive-keywords-job");
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await llmMock.stop();
   await testDb.cleanup();
});

beforeEach(() => {
   vi.clearAllMocks();
   llmMock.clearFixtures();
   llmMock.clearRequests();
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

      llmMock.onMessage(/Categoria: Food/, {
         content: JSON.stringify({ keywords: KEYWORDS }),
         systemFingerprint: "fp_test",
      });

      const result = await deriveKeywordsJob.handleDeriveKeywordsJob({
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
      expect(llmMock.getRequests().length).toBeGreaterThan(0);

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

      const first = await deriveKeywordsJob.enqueueDeriveKeywordsJob({
         boss,
         input,
      });
      const second = await deriveKeywordsJob.enqueueDeriveKeywordsJob({
         boss,
         input,
      });

      expect(Result.isOk(first)).toBe(true);
      expect(Result.isOk(second)).toBe(true);
      expect(sendDebounced).toHaveBeenCalledTimes(2);
      expect(sendDebounced).toHaveBeenNthCalledWith(
         1,
         deriveKeywordsJob.deriveKeywordsQueue.name,
         input,
         expect.any(Object),
         expect.any(Number),
         categoryId,
      );
      expect(sendDebounced).toHaveBeenNthCalledWith(
         2,
         deriveKeywordsJob.deriveKeywordsQueue.name,
         input,
         expect.any(Object),
         expect.any(Number),
         categoryId,
      );
   });

   it("enqueue failure — missing pg-boss job id returns tagged error", async () => {
      const teamId = crypto.randomUUID();
      const organizationId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();
      const sendDebounced = vi.fn().mockResolvedValue(null);
      const boss = { sendDebounced } as unknown as PgBossClient;

      const result = await deriveKeywordsJob.enqueueDeriveKeywordsJob({
         boss,
         input: {
            categoryId,
            teamId,
            organizationId,
            name: "Whatever",
         },
      });

      expect(Result.isError(result)).toBe(true);
      if (!Result.isError(result)) return;
      expect(deriveKeywordsJob.DeriveKeywordsJobError.is(result.error)).toBe(
         true,
      );
      expect(result.error.message).toBe(
         "Pg-boss não retornou o ID do job de derivação de palavras-chave.",
      );
      expect(result.error.categoryId).toBe(categoryId);
      expect(result.error.error.status).toBe(500);

      const roundTrip = Result.deserialize<void, unknown>(
         Result.serialize(result),
      );
      expect(Result.isError(roundTrip)).toBe(true);
      if (!Result.isError(roundTrip)) return;
      expect(deriveKeywordsJob.DeriveKeywordsJobError.is(roundTrip.error)).toBe(
         true,
      );
   });

   it("AI failure — job returns error and does not write", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, { name: "Food" });

      const result = await deriveKeywordsJob.handleDeriveKeywordsJob({
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
      if (!Result.isError(result)) return;
      expect(deriveKeywordsJob.DeriveKeywordsJobError.is(result.error)).toBe(
         true,
      );
      expect(result.error.message).toBe(
         "Falha ao derivar palavras-chave por IA.",
      );
      expect(result.error.categoryId).toBe(category.id);
      expect(result.error.error.status).toBe(500);
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

      llmMock.onMessage(/Categoria: Food/, {
         content: JSON.stringify({ keywords: KEYWORDS }),
         systemFingerprint: "fp_test",
      });

      await deriveKeywordsJob.handleDeriveKeywordsJob({
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
