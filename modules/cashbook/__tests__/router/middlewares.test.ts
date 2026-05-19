import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { requireValidFinancialReferences } from "../../src/router/middlewares";
import { makeCategory } from "../../../classification/__tests__/helpers/classification-factories";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

describe("finance router middlewares", () => {
   it("rejects archived categories in financial references", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const category = await makeCategory(testDb.db, teamId, {
         isArchived: true,
      });

      await expect(
         requireValidFinancialReferences(testDb.db, teamId, {
            categoryId: category.id,
         }),
      ).rejects.toMatchObject({
         error: { code: "cashbook.BAD_REQUEST" },
         message: "Categoria arquivada.",
      });
   });
});
