import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/budget-goals-repository");
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
}));

import {
   copyPreviousMonth,
   createBudgetGoal,
   deleteBudgetGoal,
   ensureBudgetGoalOwnership,
   listBudgetGoals,
   updateBudgetGoal,
} from "@core/database/repositories/budget-goals-repository";
import { AppError } from "@core/logging/errors";
import * as budgetGoalsRouter from "@/integrations/orpc/router/budget-goals";

const GOAL_ID = "a0000000-0000-4000-8000-000000000020";

const mockGoal = {
   id: GOAL_ID,
   teamId: TEST_TEAM_ID,
   categoryId: "a0000000-0000-4000-8000-000000000021",
   month: 3,
   year: 2026,
   limitAmount: "5000.00",
   alertThreshold: 80,
   alertSentAt: null,
   createdAt: new Date(),
   updatedAt: new Date(),
};

const mockGoalWithProgress = {
   ...mockGoal,
   categoryName: "Alimentação",
   categoryIcon: "utensils",
   categoryColor: "#f59e0b",
   spentAmount: "3500.00",
   percentUsed: 70,
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("getAll", () => {
   it("lists budget goals with progress", async () => {
      vi.mocked(listBudgetGoals).mockResolvedValueOnce([mockGoalWithProgress]);

      const result = await call(
         budgetGoalsRouter.getAll,
         { month: 3, year: 2026 },
         { context: createTestContext() },
      );

      expect(result).toEqual([mockGoalWithProgress]);
      expect(listBudgetGoals).toHaveBeenCalledWith(TEST_TEAM_ID, 3, 2026);
   });
});

describe("create", () => {
   it("creates a budget goal", async () => {
      vi.mocked(createBudgetGoal).mockResolvedValueOnce(mockGoal);

      const result = await call(
         budgetGoalsRouter.create,
         {
            categoryId: mockGoal.categoryId,
            month: 3,
            year: 2026,
            limitAmount: "5000.00",
            alertThreshold: 80,
         },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockGoal);
      expect(createBudgetGoal).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         expect.objectContaining({ categoryId: mockGoal.categoryId }),
      );
   });
});

describe("update", () => {
   it("updates goal after ownership check", async () => {
      vi.mocked(ensureBudgetGoalOwnership).mockResolvedValueOnce(mockGoal);
      const updated = { ...mockGoal, limitAmount: "8000.00" };
      vi.mocked(updateBudgetGoal).mockResolvedValueOnce(updated);

      const result = await call(
         budgetGoalsRouter.update,
         { id: GOAL_ID, limitAmount: "8000.00" },
         { context: createTestContext() },
      );

      expect(result.limitAmount).toBe("8000.00");
      expect(ensureBudgetGoalOwnership).toHaveBeenCalledWith(
         GOAL_ID,
         TEST_TEAM_ID,
      );
      expect(updateBudgetGoal).toHaveBeenCalledWith(GOAL_ID, TEST_TEAM_ID, {
         limitAmount: "8000.00",
      });
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureBudgetGoalOwnership).mockRejectedValueOnce(
         AppError.notFound("Meta de orçamento não encontrada."),
      );

      await expect(
         call(
            budgetGoalsRouter.update,
            { id: GOAL_ID, limitAmount: "8000.00" },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Meta de orçamento não encontrada.");
   });
});

describe("remove", () => {
   it("deletes goal after ownership check", async () => {
      vi.mocked(ensureBudgetGoalOwnership).mockResolvedValueOnce(mockGoal);
      vi.mocked(deleteBudgetGoal).mockResolvedValueOnce(undefined);

      const result = await call(
         budgetGoalsRouter.remove,
         { id: GOAL_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual({ success: true });
      expect(deleteBudgetGoal).toHaveBeenCalledWith(GOAL_ID, TEST_TEAM_ID);
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureBudgetGoalOwnership).mockRejectedValueOnce(
         AppError.notFound("Meta de orçamento não encontrada."),
      );

      await expect(
         call(
            budgetGoalsRouter.remove,
            { id: GOAL_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Meta de orçamento não encontrada.");
   });
});

describe("copyFromPreviousMonth", () => {
   it("copies goals from previous month", async () => {
      vi.mocked(copyPreviousMonth).mockResolvedValueOnce(3);

      const result = await call(
         budgetGoalsRouter.copyFromPreviousMonth,
         { month: 3, year: 2026 },
         { context: createTestContext() },
      );

      expect(result).toEqual({ count: 3 });
      expect(copyPreviousMonth).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         2,
         2026,
         3,
         2026,
      );
   });

   it("handles January wraparound", async () => {
      vi.mocked(copyPreviousMonth).mockResolvedValueOnce(2);

      const result = await call(
         budgetGoalsRouter.copyFromPreviousMonth,
         { month: 1, year: 2026 },
         { context: createTestContext() },
      );

      expect(result).toEqual({ count: 2 });
      expect(copyPreviousMonth).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         12,
         2025,
         1,
         2026,
      );
   });
});
