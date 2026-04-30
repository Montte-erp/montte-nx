import { fromPromise } from "neverthrow";
import { z } from "zod";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { executeBreakdownQuery } from "@modules/insights/compute-breakdown";
import { executeKpiQuery } from "@modules/insights/compute-kpi";
import { executeTimeSeriesQuery } from "@modules/insights/compute-time-series";
import { insightConfigSchema } from "@modules/insights/types";
import { requireDefaultDashboard } from "@modules/insights/router/middlewares";

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

export const getDefaultDashboard = protectedProcedure
   .use(requireDefaultDashboard)
   .handler(async ({ context }) => context.defaultDashboard);

export const getDashboardInsights = protectedProcedure
   .input(z.object({ dashboardId: z.string().uuid() }))
   .use(requireDefaultDashboard)
   .handler(async ({ context, input }) => {
      if (context.defaultDashboard.id !== input.dashboardId) {
         throw WebAppError.notFound("Dashboard não encontrado.");
      }

      const insightIds = [
         ...new Set(
            context.defaultDashboard.tiles.map((tile) => tile.insightId),
         ),
      ];
      if (insightIds.length === 0) return [];

      const result = await fromPromise(
         context.db.query.insights.findMany({
            where: (f, { inArray }) => inArray(f.id, insightIds),
         }),
         () => WebAppError.internal("Falha ao carregar insights."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });
