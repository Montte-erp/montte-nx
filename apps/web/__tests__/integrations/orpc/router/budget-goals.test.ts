import { call } from "@orpc/server";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
}));

import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as budgetGoalsRouter from "@/integrations/orpc/router/budget-goals";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;
let expenseCategoryId: string;

async function createExpenseCategory(
   context: ORPCContextWithAuth,
   name = "Alimentação",
) {
   const teamId = context.session!.session.activeTeamId!;
   const [cat] = await context.db
      .insert(categories)
      .values({
         teamId,
         name,
         type: "expense",
         icon: "utensils",
         color: "#f59e0b",
      })
      .returning();
   return cat!;
}

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
   ctx2 = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM budget_goals`);
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM categories`);

   const cat = await createExpenseCategory(ctx);
   expenseCategoryId = cat.id;
});

describe("create", () => {
   it("creates a budget goal and persists it", async () => {
      const result = await call(
         budgetGoalsRouter.create,
         {
            categoryId: expenseCategoryId,
            month: 3,
            year: 2026,
            limitAmount: "5000.00",
            alertThreshold: 80,
         },
         { context: ctx },
      );

      expect(result.categoryId).toBe(expenseCategoryId);
      expect(result.limitAmount).toBe("5000.00");
      expect(result.month).toBe(3);
      expect(result.year).toBe(2026);
      expect(result.alertThreshold).toBe(80);

      const rows = await ctx.db.query.budgetGoals.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.id);
   });

   it("rejects creation with income category", async () => {
      const teamId = ctx.session!.session.activeTeamId!;
      const [incomeCat] = await ctx.db
         .insert(categories)
         .values({ teamId, name: "Salário", type: "income" })
         .returning();

      await expect(
         call(
            budgetGoalsRouter.create,
            {
               categoryId: incomeCat!.id,
               month: 3,
               year: 2026,
               limitAmount: "5000.00",
            },
            { context: ctx },
         ),
      ).rejects.toThrow(
         "Orçamento só pode ser vinculado a categorias de despesa.",
      );
   });
});

describe("getAll", () => {
   it("lists budget goals with progress", async () => {
      await call(
         budgetGoalsRouter.create,
         {
            categoryId: expenseCategoryId,
            month: 3,
            year: 2026,
            limitAmount: "5000.00",
            alertThreshold: 80,
         },
         { context: ctx },
      );

      const result = await call(
         budgetGoalsRouter.getAll,
         { month: 3, year: 2026 },
         { context: ctx },
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.categoryName).toBe("Alimentação");
      expect(result[0]!.categoryIcon).toBe("utensils");
      expect(result[0]!.categoryColor).toBe("#f59e0b");
      expect(result[0]!.spentAmount).toBeDefined();
      expect(result[0]!.percentUsed).toBeDefined();
   });

   it("computes spent amount from transactions", async () => {
      await call(
         budgetGoalsRouter.create,
         {
            categoryId: expenseCategoryId,
            month: 3,
            year: 2026,
            limitAmount: "1000.00",
         },
         { context: ctx },
      );

      const teamId = ctx.session!.session.activeTeamId!;
      await ctx.db.insert(transactions).values({
         teamId,
         type: "expense",
         amount: "300.00",
         date: "2026-03-10",
         categoryId: expenseCategoryId,
      });

      const result = await call(
         budgetGoalsRouter.getAll,
         { month: 3, year: 2026 },
         { context: ctx },
      );

      expect(result[0]!.spentAmount).toBe("300.00");
      expect(result[0]!.percentUsed).toBe(30);
   });

   it("does not return goals from another team", async () => {
      await call(
         budgetGoalsRouter.create,
         {
            categoryId: expenseCategoryId,
            month: 3,
            year: 2026,
            limitAmount: "5000.00",
         },
         { context: ctx },
      );

      const result = await call(
         budgetGoalsRouter.getAll,
         { month: 3, year: 2026 },
         { context: ctx2 },
      );

      expect(result).toHaveLength(0);
   });
});

describe("update", () => {
   it("updates goal after ownership check", async () => {
      const created = await call(
         budgetGoalsRouter.create,
         {
            categoryId: expenseCategoryId,
            month: 3,
            year: 2026,
            limitAmount: "5000.00",
         },
         { context: ctx },
      );

      const updated = await call(
         budgetGoalsRouter.update,
         { id: created.id, limitAmount: "8000.00" },
         { context: ctx },
      );

      expect(updated.limitAmount).toBe("8000.00");

      const fromDb = await ctx.db.query.budgetGoals.findFirst({
         where: { id: created.id },
      });
      expect(fromDb!.limitAmount).toBe("8000.00");
   });

   it("rejects update from a different team", async () => {
      const created = await call(
         budgetGoalsRouter.create,
         {
            categoryId: expenseCategoryId,
            month: 3,
            year: 2026,
            limitAmount: "5000.00",
         },
         { context: ctx },
      );

      await expect(
         call(
            budgetGoalsRouter.update,
            { id: created.id, limitAmount: "8000.00" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Meta de orçamento não encontrada.");
   });
});

describe("remove", () => {
   it("deletes goal after ownership check", async () => {
      const created = await call(
         budgetGoalsRouter.create,
         {
            categoryId: expenseCategoryId,
            month: 3,
            year: 2026,
            limitAmount: "5000.00",
         },
         { context: ctx },
      );

      const result = await call(
         budgetGoalsRouter.remove,
         { id: created.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.budgetGoals.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deletion from a different team", async () => {
      const created = await call(
         budgetGoalsRouter.create,
         {
            categoryId: expenseCategoryId,
            month: 3,
            year: 2026,
            limitAmount: "5000.00",
         },
         { context: ctx },
      );

      await expect(
         call(budgetGoalsRouter.remove, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Meta de orçamento não encontrada.");
   });
});

describe("copyFromPreviousMonth", () => {
   it("copies goals from previous month", async () => {
      await call(
         budgetGoalsRouter.create,
         {
            categoryId: expenseCategoryId,
            month: 2,
            year: 2026,
            limitAmount: "5000.00",
            alertThreshold: 80,
         },
         { context: ctx },
      );

      const result = await call(
         budgetGoalsRouter.copyFromPreviousMonth,
         { month: 3, year: 2026 },
         { context: ctx },
      );

      expect(result).toEqual({ count: 1 });

      const marchGoals = await call(
         budgetGoalsRouter.getAll,
         { month: 3, year: 2026 },
         { context: ctx },
      );
      expect(marchGoals).toHaveLength(1);
      expect(marchGoals[0]!.limitAmount).toBe("5000.00");
   });

   it("handles January wraparound", async () => {
      await call(
         budgetGoalsRouter.create,
         {
            categoryId: expenseCategoryId,
            month: 12,
            year: 2025,
            limitAmount: "3000.00",
         },
         { context: ctx },
      );

      const result = await call(
         budgetGoalsRouter.copyFromPreviousMonth,
         { month: 1, year: 2026 },
         { context: ctx },
      );

      expect(result).toEqual({ count: 1 });

      const janGoals = await call(
         budgetGoalsRouter.getAll,
         { month: 1, year: 2026 },
         { context: ctx },
      );
      expect(janGoals).toHaveLength(1);
   });

   it("returns zero when no previous goals exist", async () => {
      const result = await call(
         budgetGoalsRouter.copyFromPreviousMonth,
         { month: 3, year: 2026 },
         { context: ctx },
      );

      expect(result).toEqual({ count: 0 });
   });
});
