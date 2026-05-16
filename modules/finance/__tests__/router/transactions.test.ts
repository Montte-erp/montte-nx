import { call } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import {
   beforeAll,
   afterAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";

const { enqueueClassifyTransactionsBatchWorkflowSpy } = vi.hoisted(() => ({
   enqueueClassifyTransactionsBatchWorkflowSpy: vi
      .fn()
      .mockResolvedValue(undefined),
}));

vi.mock("@modules/classification/workflows/classification-workflow", () => ({
   enqueueClassifyTransactionsBatchWorkflow:
      enqueueClassifyTransactionsBatchWorkflowSpy,
}));

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as transactionsRouter from "../../src/router/transactions";

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

describe("transactions router", () => {
   it("create persiste parcelas vinculadas com valores e datas determinísticos", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId, organizationId });
      const [account] = await testDb.db
         .insert(bankAccounts)
         .values({
            teamId,
            name: "Conta Parcelas",
            type: "checking",
            initialBalance: "0",
            status: "active",
         })
         .returning();

      await call(
         transactionsRouter.create,
         {
            type: "expense",
            name: "Compra parcelada",
            amount: "100.00",
            date: "2026-05-15",
            dueDate: "2026-05-20",
            status: "pending",
            ignored: false,
            bankAccountId: account.id,
            categoryId: null,
            isInstallment: true,
            installmentCount: 3,
         },
         { context: ctx },
      );

      const rows = await testDb.db
         .select()
         .from(transactions)
         .where(eq(transactions.teamId, teamId))
         .orderBy(asc(transactions.installmentNumber));

      expect(rows).toHaveLength(3);
      expect(rows.map((row) => row.amount)).toEqual([
         "33.34",
         "33.33",
         "33.33",
      ]);
      expect(rows.map((row) => row.date)).toEqual([
         "2026-05-15",
         "2026-06-15",
         "2026-07-15",
      ]);
      expect(rows.map((row) => row.dueDate)).toEqual([
         "2026-05-20",
         "2026-06-20",
         "2026-07-20",
      ]);
      expect(rows.map((row) => row.installmentNumber)).toEqual([1, 2, 3]);
      expect(rows.map((row) => row.installmentCount)).toEqual([3, 3, 3]);
      expect(rows[0]?.installmentGroupId).not.toBeNull();
      expect(
         rows.every(
            (row) => row.installmentGroupId === rows[0]?.installmentGroupId,
         ),
      ).toBe(true);
   });

   it("create rejeita transferência parcelada em pt-BR", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId, organizationId });

      await expect(
         call(
            transactionsRouter.create,
            {
               type: "transfer",
               name: "Transferência parcelada",
               amount: "100.00",
               date: "2026-05-15",
               status: "paid",
               ignored: false,
               bankAccountId: crypto.randomUUID(),
               destinationBankAccountId: crypto.randomUUID(),
               isInstallment: true,
               installmentCount: 2,
            },
            { context: ctx },
         ),
      ).rejects.toThrow("Transferências não podem ser parceladas.");
   });
});
