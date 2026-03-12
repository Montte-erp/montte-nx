import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import * as repo from "../../src/repositories/budget-goals-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

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

async function createExpenseCategory(teamId: string, name = "Alimentação") {
   const [cat] = await testDb.db
      .insert(categories)
      .values({ teamId, name, type: "expense" })
      .returning();
   return cat!;
}

async function createIncomeCategory(teamId: string, name = "Salário") {
   const [cat] = await testDb.db
      .insert(categories)
      .values({ teamId, name, type: "income" })
      .returning();
   return cat!;
}

async function createBankAccount(teamId: string) {
   const [account] = await testDb.db
      .insert(bankAccounts)
      .values({
         teamId,
         name: "Conta Teste",
         type: "checking",
         bankCode: "001",
         color: "#000000",
         initialBalance: "0.00",
      })
      .returning();
   return account!;
}

function validCreateInput(
   categoryId: string,
   overrides: Record<string, unknown> = {},
) {
   return {
      categoryId,
      month: 3,
      year: 2026,
      limitAmount: "1000.00",
      ...overrides,
   };
}

describe("budget-goals-repository", () => {
   describe("createBudgetGoal", () => {
      it("creates with correct fields", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         const goal = await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id),
         );

         expect(goal).toMatchObject({
            teamId,
            categoryId: cat.id,
            month: 3,
            year: 2026,
            limitAmount: "1000.00",
         });
         expect(goal.id).toBeDefined();
      });

      it("rejects income category", async () => {
         const teamId = randomTeamId();
         const cat = await createIncomeCategory(teamId);

         await expect(
            repo.createBudgetGoal(teamId, validCreateInput(cat.id)),
         ).rejects.toThrow(/despesa/);
      });

      it("rejects non-existent category", async () => {
         const teamId = randomTeamId();

         await expect(
            repo.createBudgetGoal(
               teamId,
               validCreateInput(crypto.randomUUID()),
            ),
         ).rejects.toThrow(/não encontrada/);
      });

      it("rejects invalid month", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);

         await expect(
            repo.createBudgetGoal(
               teamId,
               validCreateInput(cat.id, { month: 13 }),
            ),
         ).rejects.toThrow();
      });

      it("rejects duplicate (same team, category, month, year)", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);

         await repo.createBudgetGoal(teamId, validCreateInput(cat.id));

         await expect(
            repo.createBudgetGoal(teamId, validCreateInput(cat.id)),
         ).rejects.toThrow();
      });
   });

   describe("getBudgetGoal", () => {
      it("gets by id and teamId", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         const created = await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id),
         );

         const found = await repo.getBudgetGoal(created.id, teamId);
         expect(found).toMatchObject({ id: created.id, teamId });
      });

      it("returns null for non-existent", async () => {
         const found = await repo.getBudgetGoal(
            crypto.randomUUID(),
            randomTeamId(),
         );
         expect(found).toBeNull();
      });
   });

   describe("updateBudgetGoal", () => {
      it("updates limitAmount", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         const created = await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id),
         );

         const updated = await repo.updateBudgetGoal(created.id, teamId, {
            limitAmount: "2000.00",
         });
         expect(updated.limitAmount).toBe("2000.00");
      });

      it("updates alertThreshold", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         const created = await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id),
         );

         const updated = await repo.updateBudgetGoal(created.id, teamId, {
            alertThreshold: 80,
         });
         expect(updated.alertThreshold).toBe(80);
      });
   });

   describe("deleteBudgetGoal", () => {
      it("deletes and get returns null", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         const created = await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id),
         );

         await repo.deleteBudgetGoal(created.id, teamId);
         const found = await repo.getBudgetGoal(created.id, teamId);
         expect(found).toBeNull();
      });
   });

   describe("listBudgetGoals", () => {
      it("lists with spent amounts", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         const account = await createBankAccount(teamId);

         await repo.createBudgetGoal(teamId, validCreateInput(cat.id));

         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "250.00",
            date: "2026-03-15",
            bankAccountId: account.id,
            categoryId: cat.id,
         });

         const list = await repo.listBudgetGoals(teamId, 3, 2026);
         expect(list).toHaveLength(1);
         expect(Number(list[0]!.spentAmount)).toBeCloseTo(250, 0);
         expect(list[0]!.percentUsed).toBe(25);
         expect(list[0]!.categoryName).toBe("Alimentação");
      });

      it("includes subcategory spending", async () => {
         const teamId = randomTeamId();
         const parent = await createExpenseCategory(
            teamId,
            "Alimentação Parent",
         );
         const [child] = await testDb.db
            .insert(categories)
            .values({
               teamId,
               name: "Fast Food",
               type: "expense",
               parentId: parent.id,
               level: 2,
            })
            .returning();
         const account = await createBankAccount(teamId);

         await repo.createBudgetGoal(
            teamId,
            validCreateInput(parent.id, { limitAmount: "500.00" }),
         );

         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "100.00",
            date: "2026-03-10",
            bankAccountId: account.id,
            categoryId: child!.id,
         });

         const list = await repo.listBudgetGoals(teamId, 3, 2026);
         expect(list).toHaveLength(1);
         expect(Number(list[0]!.spentAmount)).toBeCloseTo(100, 0);
         expect(list[0]!.percentUsed).toBe(20);
      });
   });

   describe("copyPreviousMonth", () => {
      it("copies from one month to another", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);

         await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id, { month: 2, year: 2026 }),
         );

         const count = await repo.copyPreviousMonth(teamId, 2, 2026, 3, 2026);
         expect(count).toBe(1);

         const list = await repo.listBudgetGoals(teamId, 3, 2026);
         expect(list).toHaveLength(1);
         expect(list[0]!.limitAmount).toBe("1000.00");
      });

      it("skips duplicates", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);

         await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id, { month: 2, year: 2026 }),
         );
         await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id, { month: 3, year: 2026 }),
         );

         const count = await repo.copyPreviousMonth(teamId, 2, 2026, 3, 2026);
         expect(count).toBe(1);

         const list = await repo.listBudgetGoals(teamId, 3, 2026);
         expect(list).toHaveLength(1);
      });
   });
});
