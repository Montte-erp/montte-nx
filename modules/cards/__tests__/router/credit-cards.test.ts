import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { creditCards } from "@core/database/schemas/credit-cards";
import { seedTeam } from "@core/database/testing/factories";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { createTestContext } from "@core/orpc/testing/create-test-context";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as creditCardsRouter from "../../src/router/credit-cards";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

describe("credit cards router", () => {
   it("bulkRemove deduplica ids antes de validar e remover", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const [account] = await testDb.db
         .insert(bankAccounts)
         .values({ teamId, name: "Conta principal" })
         .returning({ id: bankAccounts.id });
      expect(account).toBeDefined();

      const [card] = await testDb.db
         .insert(creditCards)
         .values({
            teamId,
            name: "Cartão principal",
            creditLimit: "1000",
            closingDay: 10,
            dueDay: 20,
            bankAccountId: account.id,
         })
         .returning({ id: creditCards.id });
      expect(card).toBeDefined();

      const ctx = createTestContext(testDb.db, { teamId, organizationId });
      const result = await call(
         creditCardsRouter.bulkRemove,
         { ids: [card.id, card.id] },
         { context: ctx },
      );

      expect(result).toEqual({ deleted: 1 });

      const rows = await testDb.db
         .select()
         .from(creditCards)
         .where(eq(creditCards.id, card.id));
      expect(rows).toHaveLength(0);
   });
});
