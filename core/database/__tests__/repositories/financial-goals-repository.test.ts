import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import * as repo from "../../src/repositories/financial-goals-repository";

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

function validGoalInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Viagem Europa",
      targetAmount: "10000.00",
      startDate: "2026-01-01",
      ...overrides,
   };
}

describe("financial-goals-repository", () => {
   describe("createFinancialGoal", () => {
      it("creates with currentAmount=0 and isCompleted=false", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput(),
         );

         expect(goal).toMatchObject({
            teamId,
            name: "Viagem Europa",
            targetAmount: "10000.00",
            currentAmount: "0.00",
            isCompleted: false,
         });
         expect(goal.id).toBeDefined();
      });

      it("rejects name shorter than 2 chars", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createFinancialGoal(
               testDb.db,
               teamId,
               validGoalInput({ name: "A" }),
            ),
         ).rejects.toThrow(/validation failed/);
      });

      it("rejects targetDate before startDate", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createFinancialGoal(
               testDb.db,
               teamId,
               validGoalInput({
                  startDate: "2026-06-01",
                  targetDate: "2026-01-01",
               }),
            ),
         ).rejects.toThrow(/validation failed/);
      });
   });

   describe("getFinancialGoal", () => {
      it("gets by id and teamId", async () => {
         const teamId = randomTeamId();
         const created = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput(),
         );

         const found = await repo.getFinancialGoal(
            testDb.db,
            created.id,
            teamId,
         );
         expect(found).toMatchObject({ id: created.id, name: "Viagem Europa" });
      });

      it("returns null for non-existent", async () => {
         const found = await repo.getFinancialGoal(
            testDb.db,
            crypto.randomUUID(),
            randomTeamId(),
         );
         expect(found).toBeNull();
      });
   });

   describe("listFinancialGoals", () => {
      it("lists all for team", async () => {
         const teamId = randomTeamId();
         await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput({ name: "Goal A" }),
         );
         await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput({ name: "Goal B" }),
         );

         const list = await repo.listFinancialGoals(testDb.db, teamId);
         expect(list).toHaveLength(2);
      });

      it("filters by isCompleted", async () => {
         const teamId = randomTeamId();
         await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput({ name: "Complete", targetAmount: "100.00" }),
         );
         const incompleteGoal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput({ name: "Incomplete", targetAmount: "5000.00" }),
         );

         const goals = await repo.listFinancialGoals(testDb.db, teamId);
         const completeGoal = goals.find((g) => g.name === "Complete")!;

         await repo.createGoalMovement(testDb.db, completeGoal.id, {
            type: "deposit",
            amount: "100.00",
            date: "2026-01-15",
         });

         const completed = await repo.listFinancialGoals(testDb.db, teamId, {
            isCompleted: true,
         });
         expect(completed).toHaveLength(1);
         expect(completed[0]!.name).toBe("Complete");

         const incomplete = await repo.listFinancialGoals(testDb.db, teamId, {
            isCompleted: false,
         });
         expect(incomplete).toHaveLength(1);
         expect(incomplete[0]!.name).toBe("Incomplete");
      });
   });

   describe("updateFinancialGoal", () => {
      it("updates name and targetAmount", async () => {
         const teamId = randomTeamId();
         const created = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput(),
         );

         const updated = await repo.updateFinancialGoal(
            testDb.db,
            created.id,
            teamId,
            {
               name: "Viagem Japão",
               targetAmount: "20000.00",
            },
         );

         expect(updated.name).toBe("Viagem Japão");
         expect(updated.targetAmount).toBe("20000.00");
         expect(updated.id).toBe(created.id);
      });
   });

   describe("deleteFinancialGoal", () => {
      it("deletes goal and cascades movements", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput(),
         );

         await repo.createGoalMovement(testDb.db, goal.id, {
            type: "deposit",
            amount: "500.00",
            date: "2026-01-15",
         });

         await repo.deleteFinancialGoal(testDb.db, goal.id, teamId);

         const found = await repo.getFinancialGoal(testDb.db, goal.id, teamId);
         expect(found).toBeNull();

         const movements = await repo.listGoalMovements(testDb.db, goal.id);
         expect(movements).toHaveLength(0);
      });
   });

   describe("createGoalMovement", () => {
      it("deposit increases currentAmount", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput(),
         );

         const { goal: updated } = await repo.createGoalMovement(
            testDb.db,
            goal.id,
            {
               type: "deposit",
               amount: "250.00",
               date: "2026-01-15",
            },
         );

         expect(Number(updated!.currentAmount)).toBe(250);
      });

      it("withdrawal decreases currentAmount", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput(),
         );

         await repo.createGoalMovement(testDb.db, goal.id, {
            type: "deposit",
            amount: "500.00",
            date: "2026-01-15",
         });

         const { goal: updated } = await repo.createGoalMovement(
            testDb.db,
            goal.id,
            {
               type: "withdrawal",
               amount: "200.00",
               date: "2026-01-16",
            },
         );

         expect(Number(updated!.currentAmount)).toBe(300);
      });

      it("blocks withdrawal when amount > currentAmount", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput(),
         );

         await expect(
            repo.createGoalMovement(testDb.db, goal.id, {
               type: "withdrawal",
               amount: "100.00",
               date: "2026-01-15",
            }),
         ).rejects.toThrow(/saldo atual/);
      });

      it("auto-completes when currentAmount >= targetAmount", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput({ targetAmount: "100.00" }),
         );

         const { goal: updated } = await repo.createGoalMovement(
            testDb.db,
            goal.id,
            {
               type: "deposit",
               amount: "100.00",
               date: "2026-01-15",
            },
         );

         expect(updated!.isCompleted).toBe(true);
      });

      it("auto-completes when deposit exceeds targetAmount", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput({ targetAmount: "100.00" }),
         );

         const { goal: updated } = await repo.createGoalMovement(
            testDb.db,
            goal.id,
            {
               type: "deposit",
               amount: "150.00",
               date: "2026-01-15",
            },
         );

         expect(updated!.isCompleted).toBe(true);
      });
   });

   describe("deleteGoalMovement", () => {
      it("reverts deposit delta", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput(),
         );

         const { movement } = await repo.createGoalMovement(
            testDb.db,
            goal.id,
            {
               type: "deposit",
               amount: "500.00",
               date: "2026-01-15",
            },
         );

         await repo.deleteGoalMovement(testDb.db, movement.id);

         const after = await repo.getFinancialGoal(testDb.db, goal.id, teamId);
         expect(after!.currentAmount).toBe("0.00");
      });

      it("reverts isCompleted when deleting completing deposit", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput({ targetAmount: "100.00" }),
         );

         const { movement } = await repo.createGoalMovement(
            testDb.db,
            goal.id,
            {
               type: "deposit",
               amount: "100.00",
               date: "2026-01-15",
            },
         );

         await repo.deleteGoalMovement(testDb.db, movement.id);

         const after = await repo.getFinancialGoal(testDb.db, goal.id, teamId);
         expect(after!.isCompleted).toBe(false);
         expect(after!.currentAmount).toBe("0.00");
      });
   });

   describe("listGoalMovements", () => {
      it("lists in date desc order", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            testDb.db,
            teamId,
            validGoalInput(),
         );

         await repo.createGoalMovement(testDb.db, goal.id, {
            type: "deposit",
            amount: "100.00",
            date: "2026-01-10",
         });
         await repo.createGoalMovement(testDb.db, goal.id, {
            type: "deposit",
            amount: "200.00",
            date: "2026-01-20",
         });
         await repo.createGoalMovement(testDb.db, goal.id, {
            type: "deposit",
            amount: "50.00",
            date: "2026-01-15",
         });

         const movements = await repo.listGoalMovements(testDb.db, goal.id);
         expect(movements).toHaveLength(3);
         expect(movements[0]!.date).toBe("2026-01-20");
         expect(movements[1]!.date).toBe("2026-01-15");
         expect(movements[2]!.date).toBe("2026-01-10");
      });
   });
});
