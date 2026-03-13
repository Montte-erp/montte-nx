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
vi.mock("@core/logging/root", () => ({
   getLogger: () => ({ child: () => ({ warn: vi.fn(), error: vi.fn() }) }),
}));
vi.mock("@packages/events/emit", () => ({
   createEmitFn: vi.fn().mockReturnValue(vi.fn()),
}));
vi.mock("@packages/events/insight", () => ({
   emitInsightCreated: vi.fn().mockResolvedValue(undefined),
   emitInsightUpdated: vi.fn().mockResolvedValue(undefined),
   emitInsightDeleted: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@packages/analytics/compute-insight", () => ({
   computeInsightData: vi.fn(),
}));

import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as insightsRouter from "@/integrations/orpc/router/insights";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;

const validConfig = {
   type: "kpi" as const,
   measure: { aggregation: "sum" as const },
   filters: {
      dateRange: { type: "relative" as const, value: "30d" as const },
   },
};

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
   await ctx.db.execute(sql`DELETE FROM insights`);
});

describe("create", () => {
   it("creates an insight and persists it", async () => {
      const result = await call(
         insightsRouter.create,
         {
            name: "Revenue KPI",
            description: "Total revenue",
            type: "kpi",
            config: validConfig,
         },
         { context: ctx },
      );

      expect(result.name).toBe("Revenue KPI");
      expect(result.description).toBe("Total revenue");
      expect(result.type).toBe("kpi");
      expect(result.defaultSize).toBe("md");

      const rows = await ctx.db.query.insights.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.id);
   });

   it("assigns correct ownership fields", async () => {
      const result = await call(
         insightsRouter.create,
         {
            name: "Owned Insight",
            type: "kpi",
            config: validConfig,
         },
         { context: ctx },
      );

      expect(result.organizationId).toBe(
         ctx.session!.session.activeOrganizationId,
      );
      expect(result.teamId).toBe(ctx.session!.session.activeTeamId);
      expect(result.createdBy).toBe(ctx.session!.user.id);
   });
});

describe("list", () => {
   it("lists insights for the active team", async () => {
      await call(
         insightsRouter.create,
         { name: "Insight A", type: "kpi", config: validConfig },
         { context: ctx },
      );
      await call(
         insightsRouter.create,
         {
            name: "Insight B",
            type: "breakdown",
            config: {
               ...validConfig,
               type: "breakdown" as const,
               groupBy: "category",
               limit: 10,
            },
         },
         { context: ctx },
      );

      const result = await call(insightsRouter.list, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(2);
   });

   it("filters by type when provided", async () => {
      await call(
         insightsRouter.create,
         { name: "KPI", type: "kpi", config: validConfig },
         { context: ctx },
      );
      await call(
         insightsRouter.create,
         {
            name: "Breakdown",
            type: "breakdown",
            config: {
               ...validConfig,
               type: "breakdown" as const,
               groupBy: "category",
               limit: 10,
            },
         },
         { context: ctx },
      );

      const result = await call(
         insightsRouter.list,
         { type: "kpi" },
         { context: ctx },
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("kpi");
   });

   it("does not return insights from another team", async () => {
      await call(
         insightsRouter.create,
         { name: "Team 1 Insight", type: "kpi", config: validConfig },
         { context: ctx },
      );

      const result = await call(insightsRouter.list, undefined, {
         context: ctx2,
      });

      expect(result).toHaveLength(0);
   });
});

describe("getById", () => {
   it("returns insight by id", async () => {
      const created = await call(
         insightsRouter.create,
         { name: "Find Me", type: "kpi", config: validConfig },
         { context: ctx },
      );

      const result = await call(
         insightsRouter.getById,
         { id: created.id },
         { context: ctx },
      );

      expect(result.id).toBe(created.id);
      expect(result.name).toBe("Find Me");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         insightsRouter.create,
         { name: "Private", type: "kpi", config: validConfig },
         { context: ctx },
      );

      await expect(
         call(insightsRouter.getById, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Insight não encontrado.");
   });
});

describe("update", () => {
   it("updates insight after ownership check", async () => {
      const created = await call(
         insightsRouter.create,
         { name: "Original", type: "kpi", config: validConfig },
         { context: ctx },
      );

      const updated = await call(
         insightsRouter.update,
         { id: created.id, name: "Updated Name" },
         { context: ctx },
      );

      expect(updated!.name).toBe("Updated Name");

      const fromDb = await ctx.db.query.insights.findFirst({
         where: { id: created.id },
      });
      expect(fromDb!.name).toBe("Updated Name");
   });

   it("rejects update from a different team", async () => {
      const created = await call(
         insightsRouter.create,
         { name: "Owned", type: "kpi", config: validConfig },
         { context: ctx },
      );

      await expect(
         call(
            insightsRouter.update,
            { id: created.id, name: "Hacked" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Insight não encontrado.");
   });
});

describe("remove", () => {
   it("deletes insight and verifies database state", async () => {
      const created = await call(
         insightsRouter.create,
         { name: "Delete Me", type: "kpi", config: validConfig },
         { context: ctx },
      );

      const result = await call(
         insightsRouter.remove,
         { id: created.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.insights.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deletion from a different team", async () => {
      const created = await call(
         insightsRouter.create,
         { name: "Protected", type: "kpi", config: validConfig },
         { context: ctx },
      );

      await expect(
         call(insightsRouter.remove, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Insight não encontrado.");

      const rows = await ctx.db.query.insights.findMany();
      expect(rows).toHaveLength(1);
   });
});
