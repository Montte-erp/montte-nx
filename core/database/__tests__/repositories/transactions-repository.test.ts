import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { tags } from "@core/database/schemas/tags";
import { creditCards } from "@core/database/schemas/credit-cards";
import * as repo from "../../src/repositories/transactions-repository";

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

async function createTestBankAccount(teamId: string, name = "Conta Teste") {
   const [account] = await testDb.db
      .insert(bankAccounts)
      .values({ teamId, name, type: "checking", initialBalance: "1000.00" })
      .returning();
   return account!;
}

async function createTestCreditCard(teamId: string, bankAccountId: string) {
   const [card] = await testDb.db
      .insert(creditCards)
      .values({
         teamId,
         name: "Cartão Teste",
         closingDay: 25,
         dueDay: 5,
         bankAccountId,
         creditLimit: "5000.00",
      })
      .returning();
   return card!;
}

async function createTestTag(teamId: string) {
   const [tag] = await testDb.db
      .insert(tags)
      .values({ teamId, name: `Tag-${crypto.randomUUID().slice(0, 8)}` })
      .returning();
   return tag!;
}

describe("transactions-repository", () => {
   describe("validators", () => {
      it("rejects amount <= 0", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const result = await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "0",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         expect(result.isErr()).toBe(true);
      });

      it("rejects invalid date format", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const result = await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "100.00",
            date: "15/01/2026",
            bankAccountId: account.id,
         });
         expect(result.isErr()).toBe(true);
      });

      it("rejects transfer without origin account", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const result = await repo.createTransaction(testDb.db, teamId, {
            type: "transfer",
            amount: "100.00",
            date: "2026-01-15",
            destinationBankAccountId: account.id,
         });
         expect(result.isErr()).toBe(true);
      });

      it("rejects transfer without destination account", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const result = await repo.createTransaction(testDb.db, teamId, {
            type: "transfer",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         expect(result.isErr()).toBe(true);
      });

      it("rejects transfer with same origin and destination", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const result = await repo.createTransaction(testDb.db, teamId, {
            type: "transfer",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
            destinationBankAccountId: account.id,
         });
         expect(result.isErr()).toBe(true);
      });

      it("rejects expense without bank account or credit card", async () => {
         const teamId = randomTeamId();
         const result = await repo.createTransaction(testDb.db, teamId, {
            type: "expense",
            amount: "100.00",
            date: "2026-01-15",
         });
         expect(result.isErr()).toBe(true);
      });

      it("rejects income without bank account", async () => {
         const teamId = randomTeamId();
         const result = await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
         });
         expect(result.isErr()).toBe(true);
      });
   });

   describe("createTransaction", () => {
      it("creates an income transaction", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const result = await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "500.00",
            date: "2026-01-15",
            bankAccountId: account.id,
            name: "Salário",
         });

         expect(result.isOk()).toBe(true);
         const tx = result._unsafeUnwrap();
         expect(tx).toMatchObject({
            teamId,
            type: "income",
            amount: "500.00",
            name: "Salário",
         });
         expect(tx.id).toBeDefined();
      });

      it("creates a transfer transaction", async () => {
         const teamId = randomTeamId();
         const origin = await createTestBankAccount(teamId, "Origem");
         const dest = await createTestBankAccount(teamId, "Destino");

         const result = await repo.createTransaction(testDb.db, teamId, {
            type: "transfer",
            amount: "200.00",
            date: "2026-01-15",
            bankAccountId: origin.id,
            destinationBankAccountId: dest.id,
         });

         expect(result.isOk()).toBe(true);
         const tx = result._unsafeUnwrap();
         expect(tx.type).toBe("transfer");
         expect(tx.bankAccountId).toBe(origin.id);
         expect(tx.destinationBankAccountId).toBe(dest.id);
      });

      it("creates expense with credit card", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const card = await createTestCreditCard(teamId, account.id);

         const result = await repo.createTransaction(testDb.db, teamId, {
            type: "expense",
            amount: "150.00",
            date: "2026-01-15",
            creditCardId: card.id,
         });

         expect(result.isOk()).toBe(true);
         expect(result._unsafeUnwrap().creditCardId).toBe(card.id);
      });

      it("creates transaction with tag", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const tag = await createTestTag(teamId);

         const result = await repo.createTransaction(
            testDb.db,
            teamId,
            {
               type: "income",
               amount: "100.00",
               date: "2026-01-15",
               bankAccountId: account.id,
            },
            tag.id,
         );

         expect(result.isOk()).toBe(true);
         const tx = result._unsafeUnwrap();
         const tagResult = await repo.getTransactionWithTag(testDb.db, tx.id);
         expect(tagResult.isOk()).toBe(true);
         expect(tagResult._unsafeUnwrap()?.tagId).toBe(tag.id);
      });
   });

   describe("listTransactions", () => {
      it("lists transactions by teamId", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const createResult = await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         expect(createResult.isOk()).toBe(true);

         const listResult = await repo.listTransactions(testDb.db, { teamId });
         expect(listResult.isOk()).toBe(true);
         const { data, total } = listResult._unsafeUnwrap();
         expect(total).toBe(1);
         expect(data).toHaveLength(1);
      });

      it("filters by type", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         await repo.createTransaction(testDb.db, teamId, {
            type: "expense",
            amount: "50.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });

         const result = await repo.listTransactions(testDb.db, {
            teamId,
            type: "income",
         });
         expect(result.isOk()).toBe(true);
         expect(result._unsafeUnwrap().total).toBe(1);
      });

      it("filters by date range", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "200.00",
            date: "2026-02-15",
            bankAccountId: account.id,
         });

         const result = await repo.listTransactions(testDb.db, {
            teamId,
            dateFrom: "2026-02-01",
            dateTo: "2026-02-28",
         });
         expect(result.isOk()).toBe(true);
         expect(result._unsafeUnwrap().total).toBe(1);
      });
   });

   describe("getTransactionsSummary", () => {
      it("computes income, expense, and balance totals", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "1000.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         await repo.createTransaction(testDb.db, teamId, {
            type: "expense",
            amount: "300.00",
            date: "2026-01-16",
            bankAccountId: account.id,
         });

         const result = await repo.getTransactionsSummary(testDb.db, {
            teamId,
         });
         expect(result.isOk()).toBe(true);
         const summary = result._unsafeUnwrap();
         expect(summary.totalCount).toBe(2);
         expect(summary.incomeTotal).toBe("1000.00");
         expect(summary.expenseTotal).toBe("300.00");
         expect(summary.balance).toBe("700.00");
      });
   });

   describe("updateTransaction", () => {
      it("updates a transaction", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const createResult = await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
            name: "Original",
         });
         expect(createResult.isOk()).toBe(true);
         const tx = createResult._unsafeUnwrap();

         const updateResult = await repo.updateTransaction(testDb.db, tx.id, {
            name: "Updated",
         });
         expect(updateResult.isOk()).toBe(true);
         expect(updateResult._unsafeUnwrap().name).toBe("Updated");
      });

      it("updates tag", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);
         const tag1 = await createTestTag(teamId);
         const tag2 = await createTestTag(teamId);

         const createResult = await repo.createTransaction(
            testDb.db,
            teamId,
            {
               type: "income",
               amount: "100.00",
               date: "2026-01-15",
               bankAccountId: account.id,
            },
            tag1.id,
         );
         expect(createResult.isOk()).toBe(true);
         const tx = createResult._unsafeUnwrap();

         await repo.updateTransaction(
            testDb.db,
            tx.id,
            { name: "Updated" },
            tag2.id,
         );

         const withTagResult = await repo.getTransactionWithTag(
            testDb.db,
            tx.id,
         );
         expect(withTagResult.isOk()).toBe(true);
         expect(withTagResult._unsafeUnwrap()?.tagId).toBe(tag2.id);
      });
   });

   describe("deleteTransaction", () => {
      it("deletes a transaction", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const createResult = await repo.createTransaction(testDb.db, teamId, {
            type: "income",
            amount: "100.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         expect(createResult.isOk()).toBe(true);
         const tx = createResult._unsafeUnwrap();

         await repo.deleteTransaction(testDb.db, tx.id);
         const foundResult = await repo.getTransactionWithTag(testDb.db, tx.id);
         expect(foundResult.isOk()).toBe(true);
         expect(foundResult._unsafeUnwrap()).toBeNull();
      });
   });

   describe("transaction items", () => {
      it("creates and retrieves items", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const createResult = await repo.createTransaction(testDb.db, teamId, {
            type: "expense",
            amount: "200.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         expect(createResult.isOk()).toBe(true);
         const tx = createResult._unsafeUnwrap();

         await repo.createTransactionItems(testDb.db, tx.id, teamId, [
            { description: "Item 1", quantity: "2", unitPrice: "50.00" },
            { description: "Item 2", quantity: "1", unitPrice: "100.00" },
         ]);

         const itemsResult = await repo.getTransactionItems(testDb.db, tx.id);
         expect(itemsResult.isOk()).toBe(true);
         expect(itemsResult._unsafeUnwrap()).toHaveLength(2);
      });

      it("replaces items", async () => {
         const teamId = randomTeamId();
         const account = await createTestBankAccount(teamId);

         const createResult = await repo.createTransaction(testDb.db, teamId, {
            type: "expense",
            amount: "200.00",
            date: "2026-01-15",
            bankAccountId: account.id,
         });
         expect(createResult.isOk()).toBe(true);
         const tx = createResult._unsafeUnwrap();

         await repo.createTransactionItems(testDb.db, tx.id, teamId, [
            { description: "Old", quantity: "1", unitPrice: "200.00" },
         ]);

         await repo.replaceTransactionItems(testDb.db, tx.id, teamId, [
            { description: "New 1", quantity: "1", unitPrice: "100.00" },
            { description: "New 2", quantity: "1", unitPrice: "100.00" },
         ]);

         const itemsResult = await repo.getTransactionItems(testDb.db, tx.id);
         expect(itemsResult.isOk()).toBe(true);
         expect(itemsResult._unsafeUnwrap()).toHaveLength(2);
      });
   });
});
