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
import "../helpers/mock-classification-context";

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

import { deriveKeywords } from "../../src/ai/derive-keywords";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { categories } from "@core/database/schemas/categories";
import { makeCategory } from "../helpers/classification-factories";
import { deriveKeywordsWorkflow } from "../../src/workflows/derive-keywords-workflow";
import { enqueueDeriveKeywordsWorkflow } from "../../src/workflows/enqueue";

type WorkflowClient = Parameters<typeof enqueueDeriveKeywordsWorkflow>[0];

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
});

const KEYWORDS = ["fast food", "restaurant", "burger", "delivery", "cafe"];

async function getCategory(id: string) {
   const [row] = await testDb.db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
   return row;
}

describe("deriveKeywordsWorkflow", () => {
   it("category success — derives keywords and writes keywords + keywordsUpdatedAt", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, { name: "Food" });

      vi.mocked(deriveKeywords).mockReturnValue(
         Promise.resolve(ok(KEYWORDS)) as unknown as ReturnType<
            typeof deriveKeywords
         >,
      );

      await deriveKeywordsWorkflow({
         categoryId: category.id,
         teamId,
         organizationId,
         name: "Food",
         description: null,
      });

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

   it("workflow ID dedup — same categoryId produces same workflowID across enqueues", async () => {
      const teamId = crypto.randomUUID();
      const organizationId = crypto.randomUUID();
      const categoryId = crypto.randomUUID();

      const enqueueCalls: { workflowID?: string }[] = [];
      const fakeClient: WorkflowClient = {
         registerQueue: vi.fn(async () => undefined),
         enqueue: vi.fn(async (args) => {
            enqueueCalls.push(args);
            return { workflowID: args.workflowID ?? "derive-keywords-test" };
         }),
      };

      const input = {
         categoryId,
         teamId,
         organizationId,
         name: "Whatever",
      };

      const first = await enqueueDeriveKeywordsWorkflow(fakeClient, input);
      const second = await enqueueDeriveKeywordsWorkflow(fakeClient, input);

      expect(first.isOk()).toBe(true);
      expect(second.isOk()).toBe(true);
      expect(enqueueCalls).toHaveLength(2);
      expect(enqueueCalls[0]?.workflowID).toBe(`derive-category-${categoryId}`);
      expect(enqueueCalls[1]?.workflowID).toBe(`derive-category-${categoryId}`);
   });

   it("AI failure — workflow throws and does not write", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, { name: "Food" });

      vi.mocked(deriveKeywords).mockReturnValue(
         errAsync(new Error("AI failed")) as unknown as ReturnType<
            typeof deriveKeywords
         >,
      );

      await expect(
         deriveKeywordsWorkflow({
            categoryId: category.id,
            teamId,
            organizationId,
            name: "Food",
         }),
      ).rejects.toThrow();

      const after = await getCategory(category.id);
      expect(after?.keywords).toBeNull();
   });

   it("dedupes derived keywords against sibling categories", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      // Sibling already owns "burger"
      await makeCategory(testDb.db, teamId, {
         name: "Sibling",
         keywords: ["burger"],
      });
      const category = await makeCategory(testDb.db, teamId, { name: "Food" });

      vi.mocked(deriveKeywords).mockReturnValue(
         Promise.resolve(ok(KEYWORDS)) as unknown as ReturnType<
            typeof deriveKeywords
         >,
      );

      await deriveKeywordsWorkflow({
         categoryId: category.id,
         teamId,
         organizationId,
         name: "Food",
      });

      const after = await getCategory(category.id);
      expect(after?.keywords).toEqual(KEYWORDS.filter((k) => k !== "burger"));
      expect(after?.keywords).not.toContain("burger");
   });
});
