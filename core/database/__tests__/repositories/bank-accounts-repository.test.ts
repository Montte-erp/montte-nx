import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import type { DatabaseInstance } from "@core/database/client";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";
import { bills } from "@core/database/schemas/bills";

// =============================================================================
// Mock the singleton db
// =============================================================================

vi.mock("@core/database/client", async () => {
   return { db: null as unknown as DatabaseInstance };
});

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
   const clientModule = await import("@core/database/client");
   (clientModule as any).db = testDb.db;
});

afterAll(async () => {
   await testDb.cleanup();
});

// =============================================================================
// Helpers
// =============================================================================

function randomTeamId() {
   return crypto.randomUUID();
}

function validCreateInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Conta Corrente",
      type: "checking" as const,
      bankCode: "001",
      color: "#6366f1",
      initialBalance: "1000.00",
      ...overrides,
   };
}

// =============================================================================
// Tests
// =============================================================================

describe("bank-accounts-repository", () => {
   // Lazy import so the mock is in place
   let repo: typeof import("@core/database/repositories/bank-accounts-repository");

   beforeAll(async () => {
      repo =
         await import("@core/database/repositories/bank-accounts-repository");
   });

   // -------------------------------------------------------------------------
   // createBankAccount
   // -------------------------------------------------------------------------

   describe("createBankAccount", () => {
      it("creates a bank account and returns it with correct fields", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            teamId,
            validCreateInput(),
         );

         expect(account).toMatchObject({
            teamId,
            name: "Conta Corrente",
            type: "checking",
            status: "active",
            color: "#6366f1",
            initialBalance: "1000.00",
         });
         expect(account.id).toBeDefined();
         expect(account.createdAt).toBeInstanceOf(Date);
      });
   });

   // -------------------------------------------------------------------------
   // listBankAccounts
   // -------------------------------------------------------------------------

   describe("listBankAccounts", () => {
      it("lists active bank accounts only by default", async () => {
         const teamId = randomTeamId();
         await repo.createBankAccount(
            teamId,
            validCreateInput({ name: "Active" }),
         );
         const archived = await repo.createBankAccount(
            teamId,
            validCreateInput({ name: "Archived" }),
         );
         await repo.archiveBankAccount(archived.id);

         const list = await repo.listBankAccounts(teamId);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Active");
      });

      it("lists all bank accounts when includeArchived is true", async () => {
         const teamId = randomTeamId();
         await repo.createBankAccount(
            teamId,
            validCreateInput({ name: "Conta A" }),
         );
         const b = await repo.createBankAccount(
            teamId,
            validCreateInput({ name: "Conta B" }),
         );
         await repo.archiveBankAccount(b.id);

         const list = await repo.listBankAccounts(teamId, true);
         expect(list).toHaveLength(2);
      });
   });

   // -------------------------------------------------------------------------
   // getBankAccount
   // -------------------------------------------------------------------------

   describe("getBankAccount", () => {
      it("gets a bank account by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            teamId,
            validCreateInput(),
         );

         const found = await repo.getBankAccount(created.id);
         expect(found).toMatchObject({
            id: created.id,
            name: "Conta Corrente",
         });
      });

      it("returns null for non-existent id", async () => {
         const found = await repo.getBankAccount(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   // -------------------------------------------------------------------------
   // updateBankAccount
   // -------------------------------------------------------------------------

   describe("updateBankAccount", () => {
      it("updates a bank account", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            teamId,
            validCreateInput(),
         );

         const updated = await repo.updateBankAccount(created.id, {
            name: "Poupança",
         });

         expect(updated.name).toBe("Poupança");
         expect(updated.id).toBe(created.id);
      });
   });

   // -------------------------------------------------------------------------
   // archiveBankAccount / reactivateBankAccount
   // -------------------------------------------------------------------------

   describe("archiveBankAccount", () => {
      it("archives a bank account", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            teamId,
            validCreateInput(),
         );

         const archived = await repo.archiveBankAccount(created.id);
         expect(archived.status).toBe("archived");
      });
   });

   describe("reactivateBankAccount", () => {
      it("reactivates an archived bank account", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            teamId,
            validCreateInput(),
         );
         await repo.archiveBankAccount(created.id);

         const reactivated = await repo.reactivateBankAccount(created.id);
         expect(reactivated.status).toBe("active");
      });
   });

   // -------------------------------------------------------------------------
   // deleteBankAccount
   // -------------------------------------------------------------------------

   describe("deleteBankAccount", () => {
      it("deletes a bank account without transactions", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            teamId,
            validCreateInput(),
         );

         await repo.deleteBankAccount(created.id);
         const found = await repo.getBankAccount(created.id);
         expect(found).toBeNull();
      });

      it("rejects deleting a bank account with transactions", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            teamId,
            validCreateInput(),
         );

         // Insert a transaction linked to this account
         await testDb.db.insert(transactions).values({
            teamId,
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: created.id,
         });

         await expect(repo.deleteBankAccount(created.id)).rejects.toThrow(
            /lançamentos/,
         );
      });
   });

   // -------------------------------------------------------------------------
   // computeBankAccountBalance
   // -------------------------------------------------------------------------

   describe("computeBankAccountBalance", () => {
      it("computes balance correctly (income - expense - transferOut + transferIn)", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            teamId,
            validCreateInput({ initialBalance: "500.00" }),
         );
         const otherAccount = await repo.createBankAccount(
            teamId,
            validCreateInput({ name: "Outra Conta" }),
         );

         // income +200
         await testDb.db.insert(transactions).values({
            teamId,
            type: "income",
            amount: "200.00",
            date: "2026-01-01",
            bankAccountId: account.id,
         });

         // expense -50
         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "50.00",
            date: "2026-01-02",
            bankAccountId: account.id,
         });

         // transfer out -100
         await testDb.db.insert(transactions).values({
            teamId,
            type: "transfer",
            amount: "100.00",
            date: "2026-01-03",
            bankAccountId: account.id,
            destinationBankAccountId: otherAccount.id,
         });

         // transfer in +75
         await testDb.db.insert(transactions).values({
            teamId,
            type: "transfer",
            amount: "75.00",
            date: "2026-01-04",
            bankAccountId: otherAccount.id,
            destinationBankAccountId: account.id,
         });

         const { currentBalance, projectedBalance } =
            await repo.computeBankAccountBalance(account.id, "500.00");

         // 500 + 200 - 50 - 100 + 75 = 625
         expect(currentBalance).toBe("625.00");
         // No pending bills, so projected = current
         expect(projectedBalance).toBe("625.00");
      });

      it("includes pending bills in projected balance", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            teamId,
            validCreateInput({ initialBalance: "1000.00" }),
         );

         // pending receivable +300
         await testDb.db.insert(bills).values({
            teamId,
            name: "Recebível",
            type: "receivable",
            status: "pending",
            amount: "300.00",
            dueDate: "2026-02-01",
            bankAccountId: account.id,
         });

         // pending payable -150
         await testDb.db.insert(bills).values({
            teamId,
            name: "Pagável",
            type: "payable",
            status: "pending",
            amount: "150.00",
            dueDate: "2026-02-15",
            bankAccountId: account.id,
         });

         const { currentBalance, projectedBalance } =
            await repo.computeBankAccountBalance(account.id, "1000.00");

         expect(currentBalance).toBe("1000.00");
         // 1000 + 300 - 150 = 1150
         expect(projectedBalance).toBe("1150.00");
      });
   });

   // -------------------------------------------------------------------------
   // bankAccountHasTransactions
   // -------------------------------------------------------------------------

   describe("bankAccountHasTransactions", () => {
      it("returns false when no transactions exist", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            teamId,
            validCreateInput(),
         );

         const result = await repo.bankAccountHasTransactions(account.id);
         expect(result).toBe(false);
      });

      it("returns true when transactions exist", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            teamId,
            validCreateInput(),
         );

         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "10.00",
            date: "2026-01-01",
            bankAccountId: account.id,
         });

         const result = await repo.bankAccountHasTransactions(account.id);
         expect(result).toBe(true);
      });

      it("returns true when account is a transfer destination", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            teamId,
            validCreateInput(),
         );
         const other = await repo.createBankAccount(
            teamId,
            validCreateInput({ name: "Outra" }),
         );

         await testDb.db.insert(transactions).values({
            teamId,
            type: "transfer",
            amount: "50.00",
            date: "2026-01-01",
            bankAccountId: other.id,
            destinationBankAccountId: account.id,
         });

         const result = await repo.bankAccountHasTransactions(account.id);
         expect(result).toBe(true);
      });
   });
});
