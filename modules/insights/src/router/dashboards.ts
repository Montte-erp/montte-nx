import { and, eq } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import { z } from "zod";
import {
   DashboardDateRangeSchema,
   DashboardFilterSchema,
   createDashboardSchema,
   dashboardTileSchema,
   dashboards,
} from "@core/database/schemas/dashboards";
import { WebAppError } from "@core/logging/errors";
import { getLogger } from "@core/logging/root";
import { protectedProcedure } from "@core/orpc/server";
import {
   emitDashboardCreated,
   emitDashboardDeleted,
   emitDashboardUpdated,
} from "@packages/events/dashboard";
import { createEmitFn } from "@packages/events/emit";
import { requireDashboard } from "@modules/insights/router/middlewares";

const logger = getLogger().child({ module: "router:dashboards" });
const idSchema = z.object({ id: z.string().uuid() });

function logEmitFailure(event: string) {
   return (e: unknown) => {
      logger.error({ err: e, event }, "Failed to emit dashboard event");
   };
}

export const create = protectedProcedure
   .input(createDashboardSchema.pick({ name: true, description: true }))
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId, posthog } = context;

      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .insert(dashboards)
               .values({
                  organizationId,
                  teamId,
                  createdBy: userId,
                  name: input.name,
                  description: input.description,
                  tiles: [],
                  globalFilters: [],
               })
               .returning(),
         ),
         () => WebAppError.internal("Falha ao criar dashboard."),
      );
      if (result.isErr()) throw result.error;
      const [dashboard] = result.value;
      if (!dashboard) throw WebAppError.internal("Falha ao criar dashboard.");

      emitDashboardCreated(
         createEmitFn(db, posthog),
         { organizationId, userId, teamId },
         { dashboardId: dashboard.id, name: input.name },
      ).catch(logEmitFailure("dashboard.created"));

      return dashboard;
   });

export const list = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.dashboards.findMany({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
         orderBy: (f, { desc }) => [desc(f.updatedAt)],
      }),
      () => WebAppError.internal("Falha ao listar dashboards."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const getById = protectedProcedure
   .input(idSchema)
   .use(requireDashboard, (input) => input.id)
   .handler(async ({ context }) => context.dashboard);

export const update = protectedProcedure
   .input(
      idSchema.extend({
         name: z.string().min(1).optional(),
         description: z.string().optional(),
      }),
   )
   .use(requireDashboard, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId, posthog } = context;
      const { id, ...updateData } = input;

      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .update(dashboards)
               .set(updateData)
               .where(eq(dashboards.id, id))
               .returning(),
         ),
         () => WebAppError.internal("Falha ao atualizar dashboard."),
      );
      if (result.isErr()) throw result.error;
      const [updated] = result.value;
      if (!updated) throw WebAppError.notFound("Dashboard não encontrado.");

      const changedFields = Object.keys(updateData).filter(
         (k) => updateData[k as keyof typeof updateData] !== undefined,
      );
      emitDashboardUpdated(
         createEmitFn(db, posthog),
         { organizationId, userId, teamId },
         { dashboardId: id, changedFields },
      ).catch(logEmitFailure("dashboard.updated"));

      return updated;
   });

export const updateTiles = protectedProcedure
   .input(
      idSchema.extend({
         name: z.string().min(1).optional(),
         description: z.string().optional(),
         tiles: z.array(dashboardTileSchema).optional(),
      }),
   )
   .use(requireDashboard, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId, posthog } = context;

      const metadataUpdate: { name?: string; description?: string } = {};
      if (input.name !== undefined) metadataUpdate.name = input.name;
      if (input.description !== undefined)
         metadataUpdate.description = input.description;

      const result = await fromPromise(
         db.transaction(async (tx) => {
            if (input.tiles !== undefined) {
               await tx
                  .update(dashboards)
                  .set({ tiles: input.tiles })
                  .where(eq(dashboards.id, input.id));
            }
            if (Object.keys(metadataUpdate).length > 0) {
               await tx
                  .update(dashboards)
                  .set(metadataUpdate)
                  .where(eq(dashboards.id, input.id));
            }
            return tx.query.dashboards.findFirst({
               where: (f, { eq }) => eq(f.id, input.id),
            });
         }),
         () => WebAppError.internal("Falha ao atualizar dashboard."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.notFound("Dashboard não encontrado.");

      if (Object.keys(metadataUpdate).length > 0) {
         emitDashboardUpdated(
            createEmitFn(db, posthog),
            { organizationId, userId, teamId },
            {
               dashboardId: input.id,
               changedFields: Object.keys(metadataUpdate),
            },
         ).catch(logEmitFailure("dashboard.updated"));
      }

      return result.value;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireDashboard, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId, posthog, dashboard } =
         context;

      if (dashboard.isDefault) {
         const others = await fromPromise(
            db
               .select({ id: dashboards.id })
               .from(dashboards)
               .where(eq(dashboards.teamId, dashboard.teamId)),
            () => WebAppError.internal("Falha ao verificar dashboards."),
         );
         if (others.isErr()) throw others.error;
         if (others.value.length > 1) {
            throw WebAppError.badRequest(
               "Defina outro dashboard como home antes de excluir.",
            );
         }
      }

      const deleted = await fromPromise(
         db.transaction(async (tx) =>
            tx.delete(dashboards).where(eq(dashboards.id, input.id)),
         ),
         () => WebAppError.internal("Falha ao excluir dashboard."),
      );
      if (deleted.isErr()) throw deleted.error;

      emitDashboardDeleted(
         createEmitFn(db, posthog),
         { organizationId, userId, teamId },
         { dashboardId: input.id },
      ).catch(logEmitFailure("dashboard.deleted"));

      return { success: true };
   });

export const updateGlobalFilters = protectedProcedure
   .input(
      z.object({
         dashboardId: z.string().uuid(),
         globalDateRange: DashboardDateRangeSchema.nullable().optional(),
         globalFilters: z.array(DashboardFilterSchema).optional(),
      }),
   )
   .use(requireDashboard, (input) => input.dashboardId)
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId, posthog } = context;
      const updateData: Record<string, unknown> = {};
      if (input.globalDateRange !== undefined)
         updateData.globalDateRange = input.globalDateRange;
      if (input.globalFilters !== undefined)
         updateData.globalFilters = input.globalFilters;

      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .update(dashboards)
               .set(updateData)
               .where(eq(dashboards.id, input.dashboardId))
               .returning(),
         ),
         () => WebAppError.internal("Falha ao atualizar dashboard."),
      );
      if (result.isErr()) throw result.error;
      const [updated] = result.value;
      if (!updated) throw WebAppError.notFound("Dashboard não encontrado.");

      emitDashboardUpdated(
         createEmitFn(db, posthog),
         { organizationId, userId, teamId },
         {
            dashboardId: input.dashboardId,
            changedFields: Object.keys(updateData),
         },
      ).catch(logEmitFailure("dashboard.updated"));

      return updated;
   });

export const setAsHome = protectedProcedure
   .input(idSchema)
   .use(requireDashboard, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId, posthog, dashboard } =
         context;
      if (dashboard.isDefault) return dashboard;

      const result = await fromPromise(
         db.transaction(async (tx) => {
            await tx
               .update(dashboards)
               .set({ isDefault: false })
               .where(
                  and(
                     eq(dashboards.teamId, teamId),
                     eq(dashboards.isDefault, true),
                  ),
               );
            return tx
               .update(dashboards)
               .set({ isDefault: true })
               .where(eq(dashboards.id, input.id))
               .returning();
         }),
         () => WebAppError.internal("Falha ao definir dashboard como home."),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(WebAppError.notFound("Dashboard não encontrado.")),
      );
      if (result.isErr()) throw result.error;

      emitDashboardUpdated(
         createEmitFn(db, posthog),
         { organizationId, userId, teamId },
         { dashboardId: input.id, changedFields: ["isDefault"] },
      ).catch(logEmitFailure("dashboard.updated"));

      return result.value;
   });
