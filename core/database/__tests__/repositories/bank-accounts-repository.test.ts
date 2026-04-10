import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { bills } from "@core/database/schemas/bills";
import { transactions } from "@core/database/schemas/transactions";
import * as repo from "../../src/repositories/bank-accounts-repository";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

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

describe("bank-accounts-repository", () => {
   describe("createBankAccount", () => {
      it("creates a bank account and returns it with correct fields", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            testDb.db,
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

   describe("bulkCreateBankAccounts", () => {
      it("creates multiple accounts and returns them all", async () => {
         const teamId = randomTeamId();
         const rows = await repo.bulkCreateBankAccounts(testDb.db, teamId, [
            validCreateInput({ name: "Conta A" }),
            validCreateInput({ name: "Conta B" }),
            validCreateInput({ name: "Conta C" }),
         ]);

         expect(rows).toHaveLength(3);
         expect(rows.map((r) => r.name).sort()).toEqual([
            "Conta A",
            "Conta B",
            "Conta C",
         ]);
         for (const row of rows) {
            expect(row.teamId).toBe(teamId);
            expect(row.status).toBe("active");
         }
      });
   });

   describe("listBankAccounts", () => {
      it("lists active bank accounts only by default", async () => {
         const teamId = randomTeamId();
         await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput({ name: "Active" }),
         );
         const archived = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput({ name: "Archived" }),
         );
         await repo.archiveBankAccount(testDb.db, archived.id);

         const list = await repo.listBankAccounts(testDb.db, teamId);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Active");
      });

      it("lists all bank accounts when includeArchived is true", async () => {
         const teamId = randomTeamId();
         await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput({ name: "Conta A" }),
         );
         const b = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput({ name: "Conta B" }),
         );
         await repo.archiveBankAccount(testDb.db, b.id);

         const list = await repo.listBankAccounts(testDb.db, teamId, true);
         expect(list).toHaveLength(2);
      });
   });

   describe("getBankAccount", () => {
      it("gets a bank account by id", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const found = await repo.getBankAccount(testDb.db, created.id);
         expect(found).toMatchObject({
            id: created.id,
            name: "Conta Corrente",
         });
      });

      it("returns null for non-existent id", async () => {
         const found = await repo.getBankAccount(
            testDb.db,
            crypto.randomUUID(),
         );
         expect(found).toBeNull();
      });
   });

   describe("updateBankAccount", () => {
      it("updates a bank account", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const updated = await repo.updateBankAccount(testDb.db, created.id, {
            name: "Poupança",
         });

         expect(updated.name).toBe("Poupança");
         expect(updated.id).toBe(created.id);
      });
   });

   describe("archiveBankAccount", () => {
      it("archives a bank account", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const archived = await repo.archiveBankAccount(testDb.db, created.id);
         expect(archived.status).toBe("archived");
      });
   });

   describe("reactivateBankAccount", () => {
      it("reactivates an archived bank account", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         await repo.archiveBankAccount(testDb.db, created.id);

         const reactivated = await repo.reactivateBankAccount(
            testDb.db,
            created.id,
         );
         expect(reactivated.status).toBe("active");
      });
   });

   describe("deleteBankAccount", () => {
      it("deletes a bank account without transactions", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         await repo.deleteBankAccount(testDb.db, created.id);
         const found = await repo.getBankAccount(testDb.db, created.id);
         expect(found).toBeNull();
      });

      it("rejects deleting a bank account with transactions", async () => {
         const teamId = randomTeamId();
         const created = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         await testDb.db.insert(transactions).values({
            teamId,
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: created.id,
         });

         await expect(
            repo.deleteBankAccount(testDb.db, created.id),
         ).rejects.toThrow(/lançamentos/);
      });
   });

   describe("computeBankAccountBalance", () => {
      it("computes balance correctly (income - expense - transferOut + transferIn)", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput({ initialBalance: "500.00" }),
         );
         const otherAccount = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput({ name: "Outra Conta" }),
         );

         await testDb.db.insert(transactions).values({
            teamId,
            type: "income",
            amount: "200.00",
            date: "2026-01-01",
            bankAccountId: account.id,
         });

         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "50.00",
            date: "2026-01-02",
            bankAccountId: account.id,
         });

         await testDb.db.insert(transactions).values({
            teamId,
            type: "transfer",
            amount: "100.00",
            date: "2026-01-03",
            bankAccountId: account.id,
            destinationBankAccountId: otherAccount.id,
         });

         await testDb.db.insert(transactions).values({
            teamId,
            type: "transfer",
            amount: "75.00",
            date: "2026-01-04",
            bankAccountId: otherAccount.id,
            destinationBankAccountId: account.id,
         });

         const { currentBalance, projectedBalance } =
            await repo.computeBankAccountBalance(
               testDb.db,
               account.id,
               "500.00",
            );

         expect(currentBalance).toBe("625.00");
         expect(projectedBalance).toBe("625.00");
      });

      it("includes pending bills in projected balance", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput({ initialBalance: "1000.00" }),
         );

         await testDb.db.insert(bills).values({
            teamId,
            name: "Recebível",
            type: "receivable",
            status: "pending",
            amount: "300.00",
            dueDate: "2026-02-01",
            bankAccountId: account.id,
         });

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
            await repo.computeBankAccountBalance(
               testDb.db,
               account.id,
               "1000.00",
            );

         expect(currentBalance).toBe("1000.00");
         expect(projectedBalance).toBe("1150.00");
      });
   });

   describe("listBankAccountsWithBalance", () => {
      it("returns accounts with currentBalance and projectedBalance", async () => {
         const teamId = randomTeamId();
         await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput({ name: "Saldo", initialBalance: "300.00" }),
         );

         const list = await repo.listBankAccountsWithBalance(testDb.db, teamId);
         expect(list).toHaveLength(1);
         expect(list[0]!.currentBalance).toBe("300.00");
         expect(list[0]!.projectedBalance).toBe("300.00");
      });

      it("excludes archived accounts by default", async () => {
         const teamId = randomTeamId();
         await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput({ name: "Ativa" }),
         );
         const archived = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput({ name: "Arquivada" }),
         );
         await repo.archiveBankAccount(testDb.db, archived.id);

         const list = await repo.listBankAccountsWithBalance(testDb.db, teamId);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Ativa");
      });
   });

   describe("bankAccountHasTransactions", () => {
      it("returns false when no transactions exist", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput(),
         );

         const result = await repo.bankAccountHasTransactions(
            testDb.db,
            account.id,
         );
         expect(result).toBe(false);
      });

      it("returns true when transactions exist", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            testDb.db,
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

         const result = await repo.bankAccountHasTransactions(
            testDb.db,
            account.id,
         );
         expect(result).toBe(true);
      });

      it("returns true when account is a transfer destination", async () => {
         const teamId = randomTeamId();
         const account = await repo.createBankAccount(
            testDb.db,
            teamId,
            validCreateInput(),
         );
         const other = await repo.createBankAccount(
            testDb.db,
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

         const result = await repo.bankAccountHasTransactions(
            testDb.db,
            account.id,
         );
         expect(result).toBe(true);
      });
   });
});
