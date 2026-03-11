import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb, withTestTransaction } from "./setup-test-db";
import { bankAccounts } from "@core/database/schemas/bank-accounts";

describe("setupTestDb", () => {
   let db: Awaited<ReturnType<typeof setupTestDb>>["db"];
   let cleanup: () => Promise<void>;

   beforeAll(async () => {
      ({ db, cleanup } = await setupTestDb());
   }, 30_000);

   afterAll(async () => {
      await cleanup();
   });

   it("applies schema and allows queries", async () => {
      const result = await db.select().from(bankAccounts);
      expect(result).toEqual([]);
   });

   it("isolates data with withTestTransaction", async () => {
      // Insert inside transaction — gets rolled back
      await withTestTransaction(db, async (tx) => {
         await tx.insert(bankAccounts).values({
            name: "Test Account",
            type: "cash",
            teamId: "00000000-0000-0000-0000-000000000001",
         });
         const rows = await tx.select().from(bankAccounts);
         expect(rows).toHaveLength(1);
      });

      // Data should be gone after rollback
      const rows = await db.select().from(bankAccounts);
      expect(rows).toHaveLength(0);
   });
});
