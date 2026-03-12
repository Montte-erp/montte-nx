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

import { dashboards } from "@core/database/schemas/dashboards";
import { insights } from "@core/database/schemas/insights";
import { transactions } from "@core/database/schemas/transactions";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as analyticsRouter from "@/integrations/orpc/router/analytics";

let ctx: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM insights`);
   await ctx.db.execute(sql`DELETE FROM dashboards`);
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM bank_accounts`);
   await ctx.db.execute(sql`DELETE FROM categories`);
});

describe("query", () => {
   it("executes a kpi query with sum aggregation", async () => {
      const teamId = ctx.session!.session.activeTeamId!;

      await ctx.db.insert(transactions).values([
         { teamId, type: "income", amount: "500.00", date: "2026-03-01" },
         { teamId, type: "income", amount: "300.00", date: "2026-03-05" },
         { teamId, type: "expense", amount: "200.00", date: "2026-03-10" },
      ]);

      const result = await call(
         analyticsRouter.query,
         {
            config: {
               type: "kpi",
               measure: { aggregation: "sum" },
               filters: {
                  dateRange: {
                     type: "absolute",
                     start: "2026-03-01T00:00:00.000Z",
                     end: "2026-03-31T23:59:59.999Z",
                  },
                  transactionType: ["income"],
               },
            },
         },
         { context: ctx },
      );

      expect((result as any).value).toBe(800);
   });

   it("executes a kpi query with count aggregation", async () => {
      const teamId = ctx.session!.session.activeTeamId!;

      await ctx.db.insert(transactions).values([
         { teamId, type: "income", amount: "100.00", date: "2026-03-01" },
         { teamId, type: "expense", amount: "50.00", date: "2026-03-02" },
         { teamId, type: "expense", amount: "75.00", date: "2026-03-03" },
      ]);

      const result = await call(
         analyticsRouter.query,
         {
            config: {
               type: "kpi",
               measure: { aggregation: "count" },
               filters: {
                  dateRange: {
                     type: "absolute",
                     start: "2026-03-01T00:00:00.000Z",
                     end: "2026-03-31T23:59:59.999Z",
                  },
               },
            },
         },
         { context: ctx },
      );

      expect((result as any).value).toBe(3);
   });

   it("executes a time_series query", async () => {
      const teamId = ctx.session!.session.activeTeamId!;

      await ctx.db.insert(transactions).values([
         { teamId, type: "income", amount: "100.00", date: "2026-03-01" },
         { teamId, type: "income", amount: "200.00", date: "2026-03-15" },
      ]);

      const result = await call(
         analyticsRouter.query,
         {
            config: {
               type: "time_series",
               measure: { aggregation: "sum" },
               filters: {
                  dateRange: {
                     type: "absolute",
                     start: "2026-03-01T00:00:00.000Z",
                     end: "2026-03-31T23:59:59.999Z",
                  },
               },
               interval: "month",
            },
         },
         { context: ctx },
      );

      const tsResult = result as { data: unknown[] };
      expect(tsResult.data).toBeDefined();
      expect(Array.isArray(tsResult.data)).toBe(true);
      expect(tsResult.data.length).toBeGreaterThan(0);
   });

   it("executes a breakdown query grouped by transaction_type", async () => {
      const teamId = ctx.session!.session.activeTeamId!;

      await ctx.db.insert(transactions).values([
         { teamId, type: "income", amount: "500.00", date: "2026-03-01" },
         { teamId, type: "expense", amount: "200.00", date: "2026-03-05" },
         { teamId, type: "expense", amount: "100.00", date: "2026-03-10" },
      ]);

      const result = await call(
         analyticsRouter.query,
         {
            config: {
               type: "breakdown",
               measure: { aggregation: "sum" },
               filters: {
                  dateRange: {
                     type: "absolute",
                     start: "2026-03-01T00:00:00.000Z",
                     end: "2026-03-31T23:59:59.999Z",
                  },
               },
               groupBy: "transaction_type",
            },
         },
         { context: ctx },
      );

      const bdResult = result as { data: unknown[]; total: unknown };
      expect(bdResult.data).toBeDefined();
      expect(bdResult.total).toBeDefined();
      expect(bdResult.data.length).toBeGreaterThanOrEqual(2);
   });

   it("returns zero for empty dataset", async () => {
      const result = await call(
         analyticsRouter.query,
         {
            config: {
               type: "kpi",
               measure: { aggregation: "sum" },
               filters: {
                  dateRange: {
                     type: "absolute",
                     start: "2026-03-01T00:00:00.000Z",
                     end: "2026-03-31T23:59:59.999Z",
                  },
               },
            },
         },
         { context: ctx },
      );

      expect((result as any).value).toBe(0);
   });
});

describe("getDefaultDashboard", () => {
   it("returns the default dashboard for the team", async () => {
      const orgId = ctx.session!.session.activeOrganizationId!;
      const teamId = ctx.session!.session.activeTeamId!;
      const userId = ctx.session!.user.id;

      await ctx.db.insert(dashboards).values({
         organizationId: orgId,
         teamId,
         createdBy: userId,
         name: "Dashboard Principal",
         isDefault: true,
         tiles: [],
      });

      const result = await call(
         analyticsRouter.getDefaultDashboard,
         undefined,
         { context: ctx },
      );

      expect(result.name).toBe("Dashboard Principal");
      expect(result.isDefault).toBe(true);
   });

   it("throws when no default dashboard exists", async () => {
      await expect(
         call(analyticsRouter.getDefaultDashboard, undefined, {
            context: ctx,
         }),
      ).rejects.toThrow();
   });
});

describe("getDashboardInsights", () => {
   it("returns insights for dashboard tiles", async () => {
      const orgId = ctx.session!.session.activeOrganizationId!;
      const teamId = ctx.session!.session.activeTeamId!;
      const userId = ctx.session!.user.id;

      const [insight1] = await ctx.db
         .insert(insights)
         .values({
            organizationId: orgId,
            teamId,
            createdBy: userId,
            name: "Revenue KPI",
            type: "kpi",
            config: { measure: { aggregation: "sum" } },
         })
         .returning();

      const [insight2] = await ctx.db
         .insert(insights)
         .values({
            organizationId: orgId,
            teamId,
            createdBy: userId,
            name: "Expenses Breakdown",
            type: "breakdown",
            config: { measure: { aggregation: "sum" } },
         })
         .returning();

      const [dashboard] = await ctx.db
         .insert(dashboards)
         .values({
            organizationId: orgId,
            teamId,
            createdBy: userId,
            name: "Dashboard Principal",
            isDefault: true,
            tiles: [
               { insightId: insight1!.id, size: "md", order: 0 },
               { insightId: insight2!.id, size: "lg", order: 1 },
            ],
         })
         .returning();

      const result = await call(
         analyticsRouter.getDashboardInsights,
         { dashboardId: dashboard!.id },
         { context: ctx },
      );

      expect(result).toHaveLength(2);
      const names = result.map((r: any) => r.name).sort();
      expect(names).toEqual(["Expenses Breakdown", "Revenue KPI"]);
   });

   it("returns empty array when dashboard has no tiles", async () => {
      const orgId = ctx.session!.session.activeOrganizationId!;
      const teamId = ctx.session!.session.activeTeamId!;
      const userId = ctx.session!.user.id;

      const [dashboard] = await ctx.db
         .insert(dashboards)
         .values({
            organizationId: orgId,
            teamId,
            createdBy: userId,
            name: "Empty Dashboard",
            isDefault: true,
            tiles: [],
         })
         .returning();

      const result = await call(
         analyticsRouter.getDashboardInsights,
         { dashboardId: dashboard!.id },
         { context: ctx },
      );

      expect(result).toEqual([]);
   });

   it("throws when dashboardId does not match default", async () => {
      const orgId = ctx.session!.session.activeOrganizationId!;
      const teamId = ctx.session!.session.activeTeamId!;
      const userId = ctx.session!.user.id;

      await ctx.db.insert(dashboards).values({
         organizationId: orgId,
         teamId,
         createdBy: userId,
         name: "Dashboard Principal",
         isDefault: true,
         tiles: [],
      });

      const otherDashboardId = "a0000000-0000-4000-8000-000000000099";

      await expect(
         call(
            analyticsRouter.getDashboardInsights,
            { dashboardId: otherDashboardId },
            { context: ctx },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });

   it("deduplicates insight IDs from tiles", async () => {
      const orgId = ctx.session!.session.activeOrganizationId!;
      const teamId = ctx.session!.session.activeTeamId!;
      const userId = ctx.session!.user.id;

      const [insight] = await ctx.db
         .insert(insights)
         .values({
            organizationId: orgId,
            teamId,
            createdBy: userId,
            name: "Shared Insight",
            type: "kpi",
            config: {},
         })
         .returning();

      const [dashboard] = await ctx.db
         .insert(dashboards)
         .values({
            organizationId: orgId,
            teamId,
            createdBy: userId,
            name: "Dashboard",
            isDefault: true,
            tiles: [
               { insightId: insight!.id, size: "sm", order: 0 },
               { insightId: insight!.id, size: "lg", order: 1 },
            ],
         })
         .returning();

      const result = await call(
         analyticsRouter.getDashboardInsights,
         { dashboardId: dashboard!.id },
         { context: ctx },
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(insight!.id);
   });
});
