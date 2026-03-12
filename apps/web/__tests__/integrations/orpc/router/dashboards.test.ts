import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_ORG_ID,
   TEST_TEAM_ID,
   TEST_USER_ID,
   createTestContext,
} from "../../../helpers/create-test-context";
import { DASHBOARD_ID, makeDashboard } from "../../../helpers/mock-factories";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/dashboard-repository");
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
vi.mock("@packages/events/dashboard");
vi.mock("@packages/events/emit");
vi.mock("@core/redis/connection", () => ({
   redis: {},
   getRedisConnection: vi.fn(),
}));

import {
   createDashboard,
   deleteDashboard,
   ensureDashboardOwnership,
   getDashboardById,
   listDashboardsByTeam,
   setDashboardAsHome,
   updateDashboard,
   updateDashboardTiles,
} from "@core/database/repositories/dashboard-repository";
import { AppError } from "@core/logging/errors";
import {
   emitDashboardCreated,
   emitDashboardDeleted,
   emitDashboardUpdated,
} from "@packages/events/dashboard";
import * as dashboardsRouter from "@/integrations/orpc/router/dashboards";

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(emitDashboardCreated).mockResolvedValue(undefined);
   vi.mocked(emitDashboardUpdated).mockResolvedValue(undefined);
   vi.mocked(emitDashboardDeleted).mockResolvedValue(undefined);
});

describe("create", () => {
   const input = { name: "My Dashboard", description: "Test dashboard" };

   it("creates dashboard successfully", async () => {
      const dashboard = makeDashboard();
      vi.mocked(createDashboard).mockResolvedValueOnce(dashboard);

      const result = await call(dashboardsRouter.create, input, {
         context: createTestContext(),
      });

      expect(createDashboard).toHaveBeenCalledWith(
         TEST_ORG_ID,
         TEST_TEAM_ID,
         TEST_USER_ID,
         expect.objectContaining({
            name: input.name,
            description: input.description,
         }),
      );
      expect(result).toEqual(dashboard);
   });

   it("emits dashboard.created event", async () => {
      const dashboard = makeDashboard();
      vi.mocked(createDashboard).mockResolvedValueOnce(dashboard);

      await call(dashboardsRouter.create, input, {
         context: createTestContext(),
      });

      expect(emitDashboardCreated).toHaveBeenCalledWith(
         undefined,
         expect.objectContaining({
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
         }),
         expect.objectContaining({
            dashboardId: DASHBOARD_ID,
            name: input.name,
         }),
      );
   });

   it("succeeds even when event emission fails", async () => {
      const dashboard = makeDashboard();
      vi.mocked(createDashboard).mockResolvedValueOnce(dashboard);
      vi.mocked(emitDashboardCreated).mockRejectedValueOnce(
         new Error("emit failed"),
      );

      const result = await call(dashboardsRouter.create, input, {
         context: createTestContext(),
      });

      expect(result).toEqual(dashboard);
   });
});

describe("list", () => {
   it("returns list of dashboards", async () => {
      const dashboardList = [
         makeDashboard(),
         makeDashboard({ id: "dashboard-2", name: "Second Dashboard" }),
      ];
      vi.mocked(listDashboardsByTeam).mockResolvedValueOnce(dashboardList);

      const result = await call(dashboardsRouter.list, undefined, {
         context: createTestContext(),
      });

      expect(listDashboardsByTeam).toHaveBeenCalledWith(TEST_TEAM_ID);
      expect(result).toHaveLength(2);
   });
});

describe("getById", () => {
   it("returns dashboard by id", async () => {
      const dashboard = makeDashboard();
      vi.mocked(ensureDashboardOwnership).mockResolvedValueOnce(dashboard);

      const result = await call(
         dashboardsRouter.getById,
         { id: DASHBOARD_ID },
         { context: createTestContext() },
      );

      expect(ensureDashboardOwnership).toHaveBeenCalledWith(
         DASHBOARD_ID,
         TEST_ORG_ID,
         TEST_TEAM_ID,
      );
      expect(result).toEqual(dashboard);
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureDashboardOwnership).mockRejectedValueOnce(
         AppError.notFound("Dashboard não encontrado."),
      );

      await expect(
         call(
            dashboardsRouter.getById,
            { id: DASHBOARD_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});

describe("update", () => {
   const input = {
      id: DASHBOARD_ID,
      name: "Updated Dashboard",
      description: "Updated description",
   };

   it("updates dashboard after ownership check", async () => {
      vi.mocked(ensureDashboardOwnership).mockResolvedValueOnce(
         makeDashboard(),
      );
      const updated = makeDashboard({
         name: "Updated Dashboard",
         description: "Updated description",
      });
      vi.mocked(updateDashboard).mockResolvedValueOnce(updated);

      const result = await call(dashboardsRouter.update, input, {
         context: createTestContext(),
      });

      expect(updateDashboard).toHaveBeenCalledWith(
         DASHBOARD_ID,
         expect.objectContaining({
            name: "Updated Dashboard",
            description: "Updated description",
         }),
      );
      expect(result).toEqual(updated);
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureDashboardOwnership).mockRejectedValueOnce(
         AppError.notFound("Dashboard não encontrado."),
      );

      await expect(
         call(dashboardsRouter.update, input, {
            context: createTestContext(),
         }),
      ).rejects.toThrow("Dashboard não encontrado.");
   });

   it("emits dashboard.updated with correct changedFields", async () => {
      vi.mocked(ensureDashboardOwnership).mockResolvedValueOnce(
         makeDashboard(),
      );
      vi.mocked(updateDashboard).mockResolvedValueOnce(makeDashboard());

      await call(dashboardsRouter.update, input, {
         context: createTestContext(),
      });

      expect(emitDashboardUpdated).toHaveBeenCalledWith(
         undefined,
         expect.objectContaining({
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
         }),
         expect.objectContaining({
            dashboardId: DASHBOARD_ID,
            changedFields: expect.arrayContaining(["name", "description"]),
         }),
      );
   });
});

describe("updateTiles", () => {
   const input = {
      id: DASHBOARD_ID,
      tiles: [
         {
            insightId: "a1a1a1a1-b2b2-4c3c-9d4d-e5e5e5e5e5e5",
            size: "md" as const,
            order: 0,
         },
      ],
   };

   it("updates tiles successfully", async () => {
      const dashboard = makeDashboard();
      vi.mocked(ensureDashboardOwnership).mockResolvedValueOnce(dashboard);
      vi.mocked(updateDashboardTiles).mockResolvedValueOnce(undefined as any);
      vi.mocked(getDashboardById).mockResolvedValueOnce(dashboard);

      const result = await call(dashboardsRouter.updateTiles, input, {
         context: createTestContext(),
      });

      expect(updateDashboardTiles).toHaveBeenCalledWith(
         DASHBOARD_ID,
         input.tiles,
      );
      expect(result).toEqual(dashboard);
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureDashboardOwnership).mockRejectedValueOnce(
         AppError.notFound("Dashboard não encontrado."),
      );

      await expect(
         call(dashboardsRouter.updateTiles, input, {
            context: createTestContext(),
         }),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});

describe("remove", () => {
   it("deletes dashboard and emits event", async () => {
      vi.mocked(ensureDashboardOwnership).mockResolvedValueOnce(
         makeDashboard(),
      );
      vi.mocked(deleteDashboard).mockResolvedValueOnce(undefined);

      const result = await call(
         dashboardsRouter.remove,
         { id: DASHBOARD_ID },
         { context: createTestContext() },
      );

      expect(deleteDashboard).toHaveBeenCalledWith(DASHBOARD_ID);
      expect(result).toEqual({ success: true });

      expect(emitDashboardDeleted).toHaveBeenCalledWith(
         undefined,
         expect.objectContaining({
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
         }),
         expect.objectContaining({ dashboardId: DASHBOARD_ID }),
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureDashboardOwnership).mockRejectedValueOnce(
         AppError.notFound("Dashboard não encontrado."),
      );

      await expect(
         call(
            dashboardsRouter.remove,
            { id: DASHBOARD_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});

describe("setAsHome", () => {
   it("sets dashboard as home", async () => {
      vi.mocked(ensureDashboardOwnership).mockResolvedValueOnce(
         makeDashboard(),
      );
      const updated = makeDashboard({ isDefault: true });
      vi.mocked(setDashboardAsHome).mockResolvedValueOnce(updated);

      const result = await call(
         dashboardsRouter.setAsHome,
         { id: DASHBOARD_ID },
         { context: createTestContext() },
      );

      expect(setDashboardAsHome).toHaveBeenCalledWith(
         DASHBOARD_ID,
         TEST_TEAM_ID,
      );
      expect(result).toEqual(updated);
   });

   it("returns dashboard unchanged if already default", async () => {
      const dashboard = makeDashboard({ isDefault: true });
      vi.mocked(ensureDashboardOwnership).mockResolvedValueOnce(dashboard);

      const result = await call(
         dashboardsRouter.setAsHome,
         { id: DASHBOARD_ID },
         { context: createTestContext() },
      );

      expect(setDashboardAsHome).not.toHaveBeenCalled();
      expect(result).toEqual(dashboard);
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureDashboardOwnership).mockRejectedValueOnce(
         AppError.notFound("Dashboard não encontrado."),
      );

      await expect(
         call(
            dashboardsRouter.setAsHome,
            { id: DASHBOARD_ID },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });
});
