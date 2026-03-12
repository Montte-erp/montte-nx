import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateDashboardInput,
   type Dashboard,
   type DashboardTile,
   type UpdateDashboardInput,
   createDashboardSchema,
   dashboards,
   updateDashboardSchema,
} from "@core/database/schemas/dashboards";

export async function createDashboard(
   organizationId: string,
   teamId: string,
   createdBy: string,
   data: CreateDashboardInput,
) {
   const validated = validateInput(createDashboardSchema, data);
   try {
      const [dashboard] = await db
         .insert(dashboards)
         .values({
            ...validated,
            organizationId,
            teamId,
            createdBy,
         })
         .returning();
      if (!dashboard) throw AppError.database("Failed to create dashboard");
      return dashboard;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create dashboard");
   }
}

export async function listDashboards(organizationId: string) {
   try {
      return await db
         .select()
         .from(dashboards)
         .where(eq(dashboards.organizationId, organizationId))
         .orderBy(desc(dashboards.updatedAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list dashboards");
   }
}

export async function listDashboardsByTeam(teamId: string) {
   try {
      return await db
         .select()
         .from(dashboards)
         .where(eq(dashboards.teamId, teamId))
         .orderBy(desc(dashboards.updatedAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list dashboards by team");
   }
}

export async function getDashboardById(dashboardId: string) {
   try {
      const [dashboard] = await db
         .select()
         .from(dashboards)
         .where(eq(dashboards.id, dashboardId));
      return dashboard ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get dashboard");
   }
}

export async function updateDashboard(
   dashboardId: string,
   data: UpdateDashboardInput,
) {
   const validated = validateInput(updateDashboardSchema, data);
   try {
      const [updated] = await db
         .update(dashboards)
         .set(validated)
         .where(eq(dashboards.id, dashboardId))
         .returning();
      if (!updated) throw AppError.notFound("Dashboard não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update dashboard");
   }
}

export async function updateDashboardTiles(
   dashboardId: string,
   tiles: DashboardTile[],
) {
   try {
      const [updated] = await db
         .update(dashboards)
         .set({ tiles })
         .where(eq(dashboards.id, dashboardId))
         .returning();
      if (!updated) throw AppError.notFound("Dashboard não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update dashboard tiles");
   }
}

export async function deleteDashboard(dashboardId: string) {
   try {
      const dashboard = await getDashboardById(dashboardId);

      if (dashboard?.isDefault) {
         const teamDashboards = await listDashboardsByTeam(dashboard.teamId);
         if (teamDashboards.length > 1) {
            throw AppError.validation(
               "Cannot delete home dashboard. Set another dashboard as home first.",
            );
         }
      }

      await db.delete(dashboards).where(eq(dashboards.id, dashboardId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete dashboard");
   }
}

export async function setDashboardAsHome(dashboardId: string, teamId: string) {
   try {
      return await db.transaction(async (tx) => {
         await tx
            .update(dashboards)
            .set({ isDefault: false })
            .where(
               and(
                  eq(dashboards.teamId, teamId),
                  eq(dashboards.isDefault, true),
               ),
            );

         const [updated] = await tx
            .update(dashboards)
            .set({ isDefault: true })
            .where(eq(dashboards.id, dashboardId))
            .returning();

         if (!updated) throw AppError.notFound("Dashboard não encontrado.");
         return updated;
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to set dashboard as home");
   }
}

export async function getDefaultDashboard(
   organizationId: string,
   teamId: string,
): Promise<Dashboard> {
   try {
      const result = await db
         .select()
         .from(dashboards)
         .where(
            and(
               eq(dashboards.organizationId, organizationId),
               eq(dashboards.teamId, teamId),
               eq(dashboards.isDefault, true),
            ),
         )
         .limit(1);

      if (!result[0]) {
         throw AppError.notFound("Default dashboard not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get default dashboard");
   }
}
