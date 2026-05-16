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
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import {
   transactionRecurrences,
   transactions,
} from "@core/database/schemas/transactions";

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

   it("create persiste recorrência e materializa a próxima ocorrência preservando dados principais", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId, organizationId });
      const [account] = await testDb.db
         .insert(bankAccounts)
         .values({
            teamId,
            name: "Conta Recorrência",
            type: "checking",
            initialBalance: "0",
            status: "active",
         })
         .returning();
      const [category] = await testDb.db
         .insert(categories)
         .values({
            teamId,
            name: "Assinaturas",
            type: "expense",
            level: 1,
         })
         .returning();
      const [contact] = await testDb.db
         .insert(contacts)
         .values({
            teamId,
            name: "Fornecedor Recorrente",
            type: "fornecedor",
         })
         .returning();

      await call(
         transactionsRouter.create,
         {
            type: "expense",
            name: "Assinatura",
            amount: "80.00",
            date: "2026-05-15",
            dueDate: "2026-05-20",
            status: "pending",
            ignored: false,
            bankAccountId: account.id,
            categoryId: category.id,
            contactId: contact.id,
            description: "Plano mensal",
            isRecurring: true,
            recurrenceFrequency: "monthly",
         },
         { context: ctx },
      );

      const rows = await testDb.db
         .select()
         .from(transactions)
         .where(eq(transactions.teamId, teamId))
         .orderBy(asc(transactions.recurrenceOccurrenceNumber));
      const recurrences = await testDb.db
         .select()
         .from(transactionRecurrences)
         .where(eq(transactionRecurrences.teamId, teamId));

      expect(rows).toHaveLength(2);
      expect(recurrences).toHaveLength(1);
      expect(recurrences[0]?.frequency).toBe("monthly");
      expect(recurrences[0]?.status).toBe("active");
      expect(recurrences[0]?.startedAt).toBe("2026-05-15");
      expect(recurrences[0]?.nextOccurrenceDate).toBe("2026-07-15");
      expect(rows.map((row) => row.date)).toEqual(["2026-05-15", "2026-06-15"]);
      expect(rows.map((row) => row.dueDate)).toEqual([
         "2026-05-20",
         "2026-06-20",
      ]);
      expect(rows.map((row) => row.amount)).toEqual(["80.00", "80.00"]);
      expect(rows.every((row) => row.name === "Assinatura")).toBe(true);
      expect(rows.every((row) => row.status === "pending")).toBe(true);
      expect(rows.every((row) => row.description === "Plano mensal")).toBe(
         true,
      );
      expect(rows.every((row) => row.bankAccountId === account.id)).toBe(true);
      expect(rows.every((row) => row.categoryId === category.id)).toBe(true);
      expect(rows.every((row) => row.contactId === contact.id)).toBe(true);
      expect(rows[0]?.recurrenceId).not.toBeNull();
      expect(
         rows.every((row) => row.recurrenceId === rows[0]?.recurrenceId),
      ).toBe(true);
   });

   it("permite interromper e editar recorrência sem alterar lançamentos gerados", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId, organizationId });
      const [account] = await testDb.db
         .insert(bankAccounts)
         .values({
            teamId,
            name: "Conta Série",
            type: "checking",
            initialBalance: "0",
            status: "active",
         })
         .returning();

      await call(
         transactionsRouter.create,
         {
            type: "income",
            name: "Receita recorrente",
            amount: "150.00",
            date: "2026-05-15",
            status: "pending",
            ignored: false,
            bankAccountId: account.id,
            isRecurring: true,
            recurrenceFrequency: "weekly",
         },
         { context: ctx },
      );

      const [recurrence] = await testDb.db
         .select()
         .from(transactionRecurrences)
         .where(eq(transactionRecurrences.teamId, teamId));
      expect(recurrence).toBeDefined();
      if (!recurrence) return;

      await call(
         transactionsRouter.updateRecurrence,
         { id: recurrence.id, frequency: "biweekly" },
         { context: ctx },
      );
      await call(
         transactionsRouter.stopRecurrence,
         { id: recurrence.id },
         { context: ctx },
      );

      const [updatedRecurrence] = await testDb.db
         .select()
         .from(transactionRecurrences)
         .where(eq(transactionRecurrences.id, recurrence.id));
      const rows = await testDb.db
         .select()
         .from(transactions)
         .where(eq(transactions.teamId, teamId))
         .orderBy(asc(transactions.recurrenceOccurrenceNumber));

      expect(updatedRecurrence?.frequency).toBe("biweekly");
      expect(updatedRecurrence?.status).toBe("stopped");
      expect(updatedRecurrence?.stoppedAt).not.toBeNull();
      expect(rows.map((row) => row.date)).toEqual(["2026-05-15", "2026-05-22"]);
   });

   it("create rejeita recorrência parcelada em pt-BR", async () => {
      const { teamId, organizationId } = await seedTeam(testDb.db);
      const ctx = createTestContext(testDb.db, { teamId, organizationId });
      const [account] = await testDb.db
         .insert(bankAccounts)
         .values({
            teamId,
            name: "Conta Rejeição",
            type: "checking",
            initialBalance: "0",
            status: "active",
         })
         .returning();

      await expect(
         call(
            transactionsRouter.create,
            {
               type: "expense",
               name: "Conflito",
               amount: "100.00",
               date: "2026-05-15",
               status: "pending",
               ignored: false,
               bankAccountId: account.id,
               categoryId: null,
               isInstallment: true,
               installmentCount: 2,
               isRecurring: true,
               recurrenceFrequency: "monthly",
            },
            { context: ctx },
         ),
      ).rejects.toThrow("Lançamento recorrente não pode ser parcelado.");
   });
});
