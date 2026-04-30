import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import {
   createInsightSchema,
   insights,
   updateInsightSchema,
} from "@core/database/schemas/insights";
import { WebAppError } from "@core/logging/errors";
import { getLogger } from "@core/logging/root";
import { protectedProcedure } from "@core/orpc/server";
import { computeInsightData } from "@packages/analytics/compute-insight";
import {
   emitInsightCreated,
   emitInsightDeleted,
   emitInsightUpdated,
} from "@packages/events/insight";
import { createEmitFn } from "@packages/events/emit";
import {
   requireDashboard,
   requireInsight,
} from "@modules/insights/router/middlewares";

const logger = getLogger().child({ module: "router:insights" });
const idSchema = z.object({ id: z.string().uuid() });

function logEmitFailure(event: string) {
   return (e: unknown) => {
      logger.error({ err: e, event }, "Failed to emit insight event");
   };
}

export const create = protectedProcedure
   .input(createInsightSchema)
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId, posthog } = context;

      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .insert(insights)
               .values({
                  ...input,
                  organizationId,
                  teamId,
                  createdBy: userId,
               })
               .returning(),
         ),
         () => WebAppError.internal("Falha ao criar insight."),
      );
      if (result.isErr()) throw result.error;
      const [insight] = result.value;
      if (!insight) throw WebAppError.internal("Falha ao criar insight.");

      emitInsightCreated(
         createEmitFn(db, posthog),
         { organizationId, userId, teamId },
         { insightId: insight.id, name: input.name },
      ).catch(logEmitFailure("insight.created"));

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
      const result = await fromPromise(
         context.db.query.insights.findMany({
            where: (f, { and, eq }) => {
               const teamCond = eq(f.teamId, context.teamId);
               return input?.type
                  ? and(teamCond, eq(f.type, input.type))
                  : teamCond;
            },
            orderBy: (f, { desc }) => [desc(f.updatedAt)],
         }),
         () => WebAppError.internal("Falha ao listar insights."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getById = protectedProcedure
   .input(idSchema)
   .use(requireInsight, (input) => input.id)
   .handler(async ({ context }) => context.insight);

export const update = protectedProcedure
   .input(idSchema.merge(updateInsightSchema))
   .use(requireInsight, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId, posthog } = context;
      const { id, ...updateData } = input;

      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .update(insights)
               .set(updateData)
               .where(eq(insights.id, id))
               .returning(),
         ),
         () => WebAppError.internal("Falha ao atualizar insight."),
      );
      if (result.isErr()) throw result.error;
      const [updated] = result.value;
      if (!updated) throw WebAppError.notFound("Insight não encontrado.");

      const changedFields = Object.keys(updateData).filter(
         (k) => updateData[k as keyof typeof updateData] !== undefined,
      );
      emitInsightUpdated(
         createEmitFn(db, posthog),
         { organizationId, userId, teamId },
         { insightId: id, changedFields },
      ).catch(logEmitFailure("insight.updated"));

      return updated;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireInsight, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId, posthog } = context;

      const deleted = await fromPromise(
         db.transaction(async (tx) =>
            tx.delete(insights).where(eq(insights.id, input.id)),
         ),
         () => WebAppError.internal("Falha ao excluir insight."),
      );
      if (deleted.isErr()) throw deleted.error;

      emitInsightDeleted(
         createEmitFn(db, posthog),
         { organizationId, userId, teamId },
         { insightId: input.id },
      ).catch(logEmitFailure("insight.deleted"));

      return { success: true };
   });

export const refreshDashboard = protectedProcedure
   .input(z.object({ dashboardId: z.string().uuid() }))
   .use(requireDashboard, (input) => input.dashboardId)
   .handler(async ({ context }) => {
      const { db, dashboard } = context;
      const insightIds = [
         ...new Set(dashboard.tiles.map((tile) => tile.insightId)),
      ];

      if (insightIds.length === 0) {
         return { success: true, refreshedCount: 0 };
      }

      const fetched = await fromPromise(
         db.query.insights.findMany({
            where: (f, { inArray }) => inArray(f.id, insightIds),
         }),
         () => WebAppError.internal("Falha ao carregar insights."),
      );
      if (fetched.isErr()) throw fetched.error;

      await Promise.all(
         fetched.value.map(async (insight) => {
            const computed = await fromPromise(
               computeInsightData(db, insight),
               (e) => e,
            );
            if (computed.isErr()) {
               logger.error(
                  { err: computed.error, insightId: insight.id },
                  "Failed to compute insight",
               );
               return;
            }
            const updated = await fromPromise(
               db
                  .update(insights)
                  .set({
                     cachedResults: computed.value,
                     lastComputedAt: dayjs().toDate(),
                  })
                  .where(eq(insights.id, insight.id)),
               (e) => e,
            );
            if (updated.isErr()) {
               logger.error(
                  { err: updated.error, insightId: insight.id },
                  "Failed to persist insight cache",
               );
            }
         }),
      );

      return { success: true, refreshedCount: fetched.value.length };
   });
