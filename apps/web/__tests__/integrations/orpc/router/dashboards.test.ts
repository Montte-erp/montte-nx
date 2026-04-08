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
vi.mock("@packages/events/dashboard");
vi.mock("@packages/events/emit");
vi.mock("@core/redis/connection", () => ({
   createRedis: vi.fn(),
}));

import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as dashboardsRouter from "@/integrations/orpc/router/dashboards";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;

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
   await ctx.db.execute(sql`DELETE FROM platform.dashboards`);
});

describe("create", () => {
   it("creates a dashboard and persists it", async () => {
      const result = await call(
         dashboardsRouter.create,
         { name: "My Dashboard", description: "Test dashboard" },
         { context: ctx },
      );

      expect(result.name).toBe("My Dashboard");
      expect(result.description).toBe("Test dashboard");
      expect(result.organizationId).toBeDefined();
      expect(result.teamId).toBeDefined();

      const rows = await ctx.db.query.dashboards.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.id);
   });

   it("creates dashboard without description", async () => {
      const result = await call(
         dashboardsRouter.create,
         { name: "No Desc Dashboard" },
         { context: ctx },
      );

      expect(result.name).toBe("No Desc Dashboard");
      expect(result.tiles).toEqual([]);
      expect(result.isDefault).toBe(false);
   });
});

describe("list", () => {
   it("lists dashboards for the active team", async () => {
      await call(
         dashboardsRouter.create,
         { name: "Dashboard A" },
         { context: ctx },
      );
      await call(
         dashboardsRouter.create,
         { name: "Dashboard B" },
         { context: ctx },
      );

      const result = await call(dashboardsRouter.list, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(2);
   });

   it("does not list dashboards from another team", async () => {
      await call(
         dashboardsRouter.create,
         { name: "Team 1 Dashboard" },
         { context: ctx },
      );

      const result = await call(dashboardsRouter.list, undefined, {
         context: ctx2,
      });

      expect(result).toHaveLength(0);
   });
});

describe("getById", () => {
   it("returns dashboard by id", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Find Me" },
         { context: ctx },
      );

      const result = await call(
         dashboardsRouter.getById,
         { id: created.id },
         { context: ctx },
      );

      expect(result.id).toBe(created.id);
      expect(result.name).toBe("Find Me");
   });

   it("rejects access from a different team", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Private Dashboard" },
         { context: ctx },
      );

      await expect(
         call(dashboardsRouter.getById, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});

describe("update", () => {
   it("updates dashboard after ownership check", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Original" },
         { context: ctx },
      );

      const updated = await call(
         dashboardsRouter.update,
         { id: created.id, name: "Updated", description: "New desc" },
         { context: ctx },
      );

      expect(updated.name).toBe("Updated");
      expect(updated.description).toBe("New desc");

      const fromDb = await ctx.db.query.dashboards.findFirst({
         where: (fields, { eq }) => eq(fields.id, created.id),
      });
      expect(fromDb!.name).toBe("Updated");
   });

   it("rejects update from a different team", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Protected" },
         { context: ctx },
      );

      await expect(
         call(
            dashboardsRouter.update,
            { id: created.id, name: "Hacked" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});

describe("updateTiles", () => {
   it("updates tiles on a dashboard", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Tile Dashboard" },
         { context: ctx },
      );

      const insightId = "a1a1a1a1-b2b2-4c3c-9d4d-e5e5e5e5e5e5";
      const tiles = [{ insightId, size: "md" as const, order: 0 }];

      const result = await call(
         dashboardsRouter.updateTiles,
         { id: created.id, tiles },
         { context: ctx },
      );

      expect(result!.tiles).toEqual(tiles);
   });

   it("updates metadata alongside tiles", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Before" },
         { context: ctx },
      );

      const result = await call(
         dashboardsRouter.updateTiles,
         { id: created.id, name: "After", tiles: [] },
         { context: ctx },
      );

      expect(result!.name).toBe("After");
      expect(result!.tiles).toEqual([]);
   });

   it("rejects updateTiles from a different team", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Protected Tiles" },
         { context: ctx },
      );

      await expect(
         call(
            dashboardsRouter.updateTiles,
            { id: created.id, tiles: [] },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});

describe("remove", () => {
   it("deletes a dashboard", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Delete Me" },
         { context: ctx },
      );

      const result = await call(
         dashboardsRouter.remove,
         { id: created.id },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.dashboards.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects deletion from a different team", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Protected Delete" },
         { context: ctx },
      );

      await expect(
         call(dashboardsRouter.remove, { id: created.id }, { context: ctx2 }),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});

describe("setAsHome", () => {
   it("sets dashboard as home", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Home Dashboard" },
         { context: ctx },
      );

      const result = await call(
         dashboardsRouter.setAsHome,
         { id: created.id },
         { context: ctx },
      );

      expect(result.isDefault).toBe(true);
   });

   it("returns dashboard unchanged if already default", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Already Home" },
         { context: ctx },
      );

      await call(
         dashboardsRouter.setAsHome,
         { id: created.id },
         { context: ctx },
      );

      const result = await call(
         dashboardsRouter.setAsHome,
         { id: created.id },
         { context: ctx },
      );

      expect(result.isDefault).toBe(true);
   });

   it("unsets previous default when setting new home", async () => {
      const first = await call(
         dashboardsRouter.create,
         { name: "First Home" },
         { context: ctx },
      );
      const second = await call(
         dashboardsRouter.create,
         { name: "Second Home" },
         { context: ctx },
      );

      await call(
         dashboardsRouter.setAsHome,
         { id: first.id },
         { context: ctx },
      );
      await call(
         dashboardsRouter.setAsHome,
         { id: second.id },
         { context: ctx },
      );

      const firstFromDb = await ctx.db.query.dashboards.findFirst({
         where: (fields, { eq }) => eq(fields.id, first.id),
      });
      const secondFromDb = await ctx.db.query.dashboards.findFirst({
         where: (fields, { eq }) => eq(fields.id, second.id),
      });

      expect(firstFromDb!.isDefault).toBe(false);
      expect(secondFromDb!.isDefault).toBe(true);
   });

   it("rejects setAsHome from a different team", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Not Yours" },
         { context: ctx },
      );

      await expect(
         call(
            dashboardsRouter.setAsHome,
            { id: created.id },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});

describe("updateGlobalFilters", () => {
   it("updates global date range", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Filter Dashboard" },
         { context: ctx },
      );

      const result = await call(
         dashboardsRouter.updateGlobalFilters,
         {
            dashboardId: created.id,
            globalDateRange: { type: "relative", value: "7d" },
         },
         { context: ctx },
      );

      expect(result.globalDateRange).toEqual({ type: "relative", value: "7d" });
   });

   it("clears global date range with null", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Clear Filter Dashboard" },
         { context: ctx },
      );

      await call(
         dashboardsRouter.updateGlobalFilters,
         {
            dashboardId: created.id,
            globalDateRange: { type: "relative", value: "30d" },
         },
         { context: ctx },
      );

      const result = await call(
         dashboardsRouter.updateGlobalFilters,
         {
            dashboardId: created.id,
            globalDateRange: null,
         },
         { context: ctx },
      );

      expect(result.globalDateRange).toBeNull();
   });

   it("rejects updateGlobalFilters from a different team", async () => {
      const created = await call(
         dashboardsRouter.create,
         { name: "Protected Filters" },
         { context: ctx },
      );

      await expect(
         call(
            dashboardsRouter.updateGlobalFilters,
            { dashboardId: created.id, globalDateRange: null },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});
