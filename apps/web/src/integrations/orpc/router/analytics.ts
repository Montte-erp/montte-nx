import { executeBreakdownQuery } from "@packages/analytics/compute-breakdown";
import { executeKpiQuery } from "@packages/analytics/compute-kpi";
import { executeTimeSeriesQuery } from "@packages/analytics/compute-time-series";
import { insightConfigSchema } from "@packages/analytics/types";
import { getDefaultDashboard as fetchDefaultDashboard } from "@core/database/repositories/dashboard-repository";
import { getInsightsByIds } from "@core/database/repositories/insight-repository";
import { AppError } from "@core/logging/errors";
import { z } from "zod";
import { protectedProcedure } from "../server";

export const query = protectedProcedure
   .input(z.object({ config: insightConfigSchema }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      switch (input.config.type) {
         case "kpi":
            return executeKpiQuery(db, teamId, input.config);
         case "time_series":
            return executeTimeSeriesQuery(db, teamId, input.config);
         case "breakdown":
            return executeBreakdownQuery(db, teamId, input.config);
      }
   });

export const getDefaultDashboard = protectedProcedure.handler(
   async ({ context }) => {
      return fetchDefaultDashboard(
         context.db,
         context.organizationId,
         context.teamId,
      );
   },
);

export const getDashboardInsights = protectedProcedure
   .input(z.object({ dashboardId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const dashboard = await fetchDefaultDashboard(
         context.db,
         context.organizationId,
         context.teamId,
      );

      if (dashboard.id !== input.dashboardId) {
         throw AppError.notFound("Dashboard não encontrado.");
      }

      const insightIds = [
         ...new Set(dashboard.tiles.map((tile) => tile.insightId)),
      ];

      if (insightIds.length === 0) {
         return [];
      }

      return getInsightsByIds(context.db, insightIds);
   });
