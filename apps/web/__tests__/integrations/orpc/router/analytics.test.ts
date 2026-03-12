import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_ORG_ID,
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/dashboard-repository");
vi.mock("@core/database/repositories/insight-repository");
vi.mock("@packages/analytics/compute-breakdown");
vi.mock("@packages/analytics/compute-kpi");
vi.mock("@packages/analytics/compute-time-series");
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

import { getDefaultDashboard } from "@core/database/repositories/dashboard-repository";
import { getInsightsByIds } from "@core/database/repositories/insight-repository";
import { executeBreakdownQuery } from "@packages/analytics/compute-breakdown";
import { executeKpiQuery } from "@packages/analytics/compute-kpi";
import { executeTimeSeriesQuery } from "@packages/analytics/compute-time-series";
import { AppError } from "@core/logging/errors";
import * as analyticsRouter from "@/integrations/orpc/router/analytics";

const DASHBOARD_ID = "a0000000-0000-4000-8000-000000000020";
const INSIGHT_ID_1 = "a0000000-0000-4000-8000-000000000021";
const INSIGHT_ID_2 = "a0000000-0000-4000-8000-000000000022";

const kpiConfig = {
   type: "kpi" as const,
   measure: { aggregation: "sum" as const },
   filters: { dateRange: { type: "relative" as const, value: "30d" as const } },
};

const timeSeriesConfig = {
   type: "time_series" as const,
   measure: { aggregation: "sum" as const },
   filters: { dateRange: { type: "relative" as const, value: "30d" as const } },
};

const breakdownConfig = {
   type: "breakdown" as const,
   measure: { aggregation: "sum" as const },
   filters: { dateRange: { type: "relative" as const, value: "30d" as const } },
};

const mockDashboard = {
   id: DASHBOARD_ID,
   organizationId: TEST_ORG_ID,
   teamId: TEST_TEAM_ID,
   name: "Dashboard Principal",
   isDefault: true,
   tiles: [
      { insightId: INSIGHT_ID_1, position: { x: 0, y: 0, w: 6, h: 4 } },
      { insightId: INSIGHT_ID_2, position: { x: 6, y: 0, w: 6, h: 4 } },
      { insightId: INSIGHT_ID_1, position: { x: 0, y: 4, w: 12, h: 4 } },
   ],
   createdBy: "a0000000-0000-4000-8000-000000000001",
   createdAt: new Date(),
   updatedAt: new Date(),
};

const mockInsights = [
   {
      id: INSIGHT_ID_1,
      name: "Revenue KPI",
      type: "kpi",
      lastComputedAt: new Date(),
   },
   {
      id: INSIGHT_ID_2,
      name: "Expenses Breakdown",
      type: "breakdown",
      lastComputedAt: new Date(),
   },
];

beforeEach(() => {
   vi.clearAllMocks();
});

describe("query", () => {
   it("dispatches kpi config to executeKpiQuery", async () => {
      const kpiResult = { value: 5000, comparison: null };
      vi.mocked(executeKpiQuery).mockResolvedValueOnce(kpiResult);

      const result = await call(
         analyticsRouter.query,
         { config: kpiConfig },
         { context: createTestContext() },
      );

      expect(result).toEqual(kpiResult);
      expect(executeKpiQuery).toHaveBeenCalledWith(
         expect.anything(),
         TEST_TEAM_ID,
         expect.objectContaining({ type: "kpi" }),
      );
   });

   it("dispatches time_series config to executeTimeSeriesQuery", async () => {
      const tsResult = { data: [{ date: "2026-01-01", value: 100 }] };
      vi.mocked(executeTimeSeriesQuery).mockResolvedValueOnce(tsResult);

      const result = await call(
         analyticsRouter.query,
         { config: timeSeriesConfig },
         { context: createTestContext() },
      );

      expect(result).toEqual(tsResult);
      expect(executeTimeSeriesQuery).toHaveBeenCalledWith(
         expect.anything(),
         TEST_TEAM_ID,
         expect.objectContaining({ type: "time_series" }),
      );
   });

   it("dispatches breakdown config to executeBreakdownQuery", async () => {
      const bdResult = { data: [{ label: "Food", value: 200 }] };
      vi.mocked(executeBreakdownQuery).mockResolvedValueOnce(bdResult);

      const result = await call(
         analyticsRouter.query,
         { config: breakdownConfig },
         { context: createTestContext() },
      );

      expect(result).toEqual(bdResult);
      expect(executeBreakdownQuery).toHaveBeenCalledWith(
         expect.anything(),
         TEST_TEAM_ID,
         expect.objectContaining({ type: "breakdown" }),
      );
   });

   it("propagates errors from query engine", async () => {
      vi.mocked(executeKpiQuery).mockRejectedValueOnce(
         AppError.database("Falha ao executar consulta analítica"),
      );

      await expect(
         call(
            analyticsRouter.query,
            { config: kpiConfig },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Falha ao executar consulta analítica");
   });
});

describe("getDefaultDashboard", () => {
   it("returns the default dashboard", async () => {
      vi.mocked(getDefaultDashboard).mockResolvedValueOnce(
         mockDashboard as any,
      );

      const result = await call(
         analyticsRouter.getDefaultDashboard,
         undefined,
         { context: createTestContext() },
      );

      expect(result).toEqual(mockDashboard);
      expect(getDefaultDashboard).toHaveBeenCalledWith(
         TEST_ORG_ID,
         TEST_TEAM_ID,
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(getDefaultDashboard).mockRejectedValueOnce(
         AppError.notFound("Default dashboard not found"),
      );

      await expect(
         call(analyticsRouter.getDefaultDashboard, undefined, {
            context: createTestContext(),
         }),
      ).rejects.toThrow("Default dashboard not found");
   });
});

describe("getDashboardInsights", () => {
   it("returns insights for dashboard tiles", async () => {
      vi.mocked(getDefaultDashboard).mockResolvedValueOnce(
         mockDashboard as any,
      );
      vi.mocked(getInsightsByIds).mockResolvedValueOnce(mockInsights as any);

      const result = await call(
         analyticsRouter.getDashboardInsights,
         { dashboardId: DASHBOARD_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual(mockInsights);
      expect(getInsightsByIds).toHaveBeenCalledWith([
         INSIGHT_ID_1,
         INSIGHT_ID_2,
      ]);
   });

   it("returns empty array when dashboard has no tiles", async () => {
      vi.mocked(getDefaultDashboard).mockResolvedValueOnce({
         ...mockDashboard,
         tiles: [],
      } as any);

      const result = await call(
         analyticsRouter.getDashboardInsights,
         { dashboardId: DASHBOARD_ID },
         { context: createTestContext() },
      );

      expect(result).toEqual([]);
      expect(getInsightsByIds).not.toHaveBeenCalled();
   });

   it("throws NOT_FOUND when dashboardId does not match", async () => {
      vi.mocked(getDefaultDashboard).mockResolvedValueOnce(
         mockDashboard as any,
      );

      const otherDashboardId = "a0000000-0000-4000-8000-000000000099";

      await expect(
         call(
            analyticsRouter.getDashboardInsights,
            { dashboardId: otherDashboardId },
            { context: createTestContext() },
         ),
      ).rejects.toThrow("Dashboard não encontrado.");
   });

   it("deduplicates insight IDs from tiles", async () => {
      vi.mocked(getDefaultDashboard).mockResolvedValueOnce(
         mockDashboard as any,
      );
      vi.mocked(getInsightsByIds).mockResolvedValueOnce(mockInsights as any);

      await call(
         analyticsRouter.getDashboardInsights,
         { dashboardId: DASHBOARD_ID },
         { context: createTestContext() },
      );

      expect(getInsightsByIds).toHaveBeenCalledWith([
         INSIGHT_ID_1,
         INSIGHT_ID_2,
      ]);
   });
});
