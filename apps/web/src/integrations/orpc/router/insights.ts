import { computeInsightData } from "@packages/analytics/compute-insight";
import { ensureDashboardOwnership } from "@core/database/repositories/dashboard-repository";
import {
   createInsight,
   deleteInsight,
   ensureInsightOwnership,
   getInsightById,
   listInsightsByTeam,
   updateInsight,
} from "@core/database/repositories/insight-repository";
import { insights } from "@core/database/schemas/insights";
import { createEmitFn } from "@packages/events/emit";
import {
   emitInsightCreated,
   emitInsightDeleted,
   emitInsightUpdated,
} from "@packages/events/insight";
import { getLogger } from "@core/logging/root";
import { insightConfigSchema } from "@packages/analytics/types";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../server";

const logger = getLogger().child({ module: "router:insights" });

const idSchema = z.object({ id: z.string().uuid() });

const createInputSchema = z.object({
   name: z.string().min(1),
   description: z.string().optional(),
   type: z.enum(["kpi", "time_series", "breakdown"]),
   config: insightConfigSchema,
   defaultSize: z.enum(["sm", "md", "lg", "full"]).optional().default("md"),
});

const updateInputSchema = idSchema.merge(
   z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      config: insightConfigSchema.optional(),
      defaultSize: z.enum(["sm", "md", "lg", "full"]).optional(),
   }),
);

export const create = protectedProcedure
   .input(createInputSchema)
   .handler(async ({ context, input }) => {
      const { db, organizationId, userId, teamId, posthog } = context;

      const insight = await createInsight(db, organizationId, teamId, userId, {
         name: input.name,
         description: input.description,
         type: input.type,
         config: input.config,
         defaultSize: input.defaultSize,
      });

      try {
         await emitInsightCreated(
            createEmitFn(db, posthog),
            { organizationId, userId, teamId },
            { insightId: insight.id, name: input.name },
         );
      } catch {}

      return insight;
   });

export const list = protectedProcedure
   .input(
      z
         .object({
            type: z.enum(["kpi", "time_series", "breakdown"]).optional(),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      return listInsightsByTeam(context.db, context.teamId, input?.type);
   });

export const getById = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      return ensureInsightOwnership(
         context.db,
         input.id,
         context.organizationId,
         context.teamId,
      );
   });

export const update = protectedProcedure
   .input(updateInputSchema)
   .handler(async ({ context, input }) => {
      const { db, organizationId, userId, teamId, posthog } = context;

      await ensureInsightOwnership(db, input.id, organizationId, teamId);

      const { id, ...updateData } = input;
      const updated = await updateInsight(db, id, updateData);

      try {
         const changedFields = Object.keys(updateData).filter(
            (k) => updateData[k as keyof typeof updateData] !== undefined,
         );
         await emitInsightUpdated(
            createEmitFn(db, posthog),
            { organizationId, userId, teamId },
            { insightId: id, changedFields },
         );
      } catch {}

      return updated;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const { db, organizationId, userId, teamId, posthog } = context;

      await ensureInsightOwnership(db, input.id, organizationId, teamId);
      await deleteInsight(db, input.id);

      try {
         await emitInsightDeleted(
            createEmitFn(db, posthog),
            { organizationId, userId, teamId },
            { insightId: input.id },
         );
      } catch {}

      return { success: true };
   });

export const refreshDashboard = protectedProcedure
   .input(z.object({ dashboardId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId } = context;

      const dashboard = await ensureDashboardOwnership(
         db,
         input.dashboardId,
         organizationId,
         teamId,
      );

      const insightIds = [
         ...new Set(dashboard.tiles.map((tile) => tile.insightId)),
      ];

      const refreshPromises = insightIds.map(async (insightId) => {
         try {
            const insight = await getInsightById(db, insightId);
            if (!insight) {
               logger.warn({ insightId }, "Insight not found during refresh");
               return;
            }

            const freshData = await computeInsightData(db, insight);

            await db
               .update(insights)
               .set({
                  cachedResults: freshData,
                  lastComputedAt: new Date(),
               })
               .where(eq(insights.id, insightId));
         } catch (error) {
            logger.error(
               { err: error, insightId },
               "Failed to refresh insight",
            );
         }
      });

      await Promise.all(refreshPromises);

      return {
         success: true,
         refreshedCount: insightIds.length,
      };
   });
