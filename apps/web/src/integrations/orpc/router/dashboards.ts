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
import {
   DashboardDateRangeSchema,
   DashboardFilterSchema,
   createDashboardSchema,
   dashboardTileSchema,
} from "@core/database/schemas/dashboards";
import {
   emitDashboardCreated,
   emitDashboardDeleted,
   emitDashboardUpdated,
} from "@packages/events/dashboard";
import { createEmitFn } from "@packages/events/emit";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createDashboardSchema.pick({ name: true, description: true }))
   .handler(async ({ context, input }) => {
      const { organizationId, userId, teamId, db, posthog } = context;

      const dashboard = await createDashboard(organizationId, teamId, userId, {
         name: input.name,
         description: input.description,
         tiles: [],
         globalFilters: [],
      });

      try {
         await emitDashboardCreated(
            createEmitFn(db, posthog),
            { organizationId, userId, teamId },
            { dashboardId: dashboard.id, name: input.name },
         );
      } catch {}

      return dashboard;
   });

export const list = protectedProcedure.handler(async ({ context }) => {
   return listDashboardsByTeam(context.teamId);
});

export const getById = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      return ensureDashboardOwnership(
         input.id,
         context.organizationId,
         context.teamId,
      );
   });

export const update = protectedProcedure
   .input(
      idSchema.extend({
         name: z.string().min(1).optional(),
         description: z.string().optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { organizationId, userId, teamId, db, posthog } = context;
      await ensureDashboardOwnership(input.id, organizationId, teamId);

      const { id, ...updateData } = input;
      const updated = await updateDashboard(id, updateData);

      try {
         const changedFields = Object.keys(updateData).filter(
            (k) => updateData[k as keyof typeof updateData] !== undefined,
         );
         await emitDashboardUpdated(
            createEmitFn(db, posthog),
            { organizationId, userId, teamId },
            { dashboardId: id, changedFields },
         );
      } catch {}

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
   .handler(async ({ context, input }) => {
      const { organizationId, teamId, db, posthog, userId } = context;
      await ensureDashboardOwnership(input.id, organizationId, teamId);

      if (input.tiles !== undefined) {
         await updateDashboardTiles(input.id, input.tiles);
      }

      const metadataUpdate: { name?: string; description?: string } = {};
      if (input.name !== undefined) metadataUpdate.name = input.name;
      if (input.description !== undefined)
         metadataUpdate.description = input.description;

      if (Object.keys(metadataUpdate).length > 0) {
         await updateDashboard(input.id, metadataUpdate);

         try {
            const changedFields = Object.keys(metadataUpdate);
            await emitDashboardUpdated(
               createEmitFn(db, posthog),
               { organizationId, userId, teamId },
               { dashboardId: input.id, changedFields },
            );
         } catch {}
      }

      return getDashboardById(input.id);
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const { organizationId, userId, teamId, db, posthog } = context;
      await ensureDashboardOwnership(input.id, organizationId, teamId);

      await deleteDashboard(input.id);

      try {
         await emitDashboardDeleted(
            createEmitFn(db, posthog),
            { organizationId, userId, teamId },
            { dashboardId: input.id },
         );
      } catch {}

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
   .handler(async ({ context, input }) => {
      const { organizationId, teamId, db, posthog, userId } = context;
      await ensureDashboardOwnership(input.dashboardId, organizationId, teamId);

      const updateData: Record<string, unknown> = {};
      if (input.globalDateRange !== undefined)
         updateData.globalDateRange = input.globalDateRange;
      if (input.globalFilters !== undefined)
         updateData.globalFilters = input.globalFilters;

      const updated = await updateDashboard(input.dashboardId, updateData);

      try {
         const changedFields = Object.keys(updateData);
         await emitDashboardUpdated(
            createEmitFn(db, posthog),
            { organizationId, userId, teamId },
            { dashboardId: input.dashboardId, changedFields },
         );
      } catch {}

      return updated;
   });

export const setAsHome = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const { organizationId, teamId, db, posthog, userId } = context;
      const dashboard = await ensureDashboardOwnership(
         input.id,
         organizationId,
         teamId,
      );

      if (dashboard.isDefault) {
         return dashboard;
      }

      const updated = await setDashboardAsHome(input.id, teamId);

      try {
         await emitDashboardUpdated(
            createEmitFn(db, posthog),
            { organizationId, userId, teamId },
            { dashboardId: input.id, changedFields: ["isDefault"] },
         );
      } catch {}

      return updated;
   });
