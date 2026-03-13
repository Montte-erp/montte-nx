import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, desc, eq } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateDashboardInput,
   type Dashboard,
   type DashboardTile,
   type UpdateDashboardInput,
   createDashboardSchema,
   dashboards,
   updateDashboardSchema,
} from "@core/database/schemas/dashboards";

export async function ensureDashboardOwnership(
   db: DatabaseInstance,
   id: string,
   organizationId: string,
   teamId: string,
) {
   const dashboard = await getDashboardById(db, id);
   if (
      !dashboard ||
      dashboard.organizationId !== organizationId ||
      dashboard.teamId !== teamId
   ) {
      throw AppError.notFound("Dashboard não encontrado.");
   }
   return dashboard;
}

export async function createDashboard(
   db: DatabaseInstance,
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

export async function listDashboards(
   db: DatabaseInstance,
   organizationId: string,
) {
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

export async function listDashboardsByTeam(
   db: DatabaseInstance,
   teamId: string,
) {
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

export async function getDashboardById(
   db: DatabaseInstance,
   dashboardId: string,
) {
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
   db: DatabaseInstance,
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
   db: DatabaseInstance,
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

export async function deleteDashboard(
   db: DatabaseInstance,
   dashboardId: string,
) {
   try {
      const dashboard = await getDashboardById(db, dashboardId);

      if (dashboard?.isDefault) {
         const teamDashboards = await listDashboardsByTeam(
            db,
            dashboard.teamId,
         );
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

export async function setDashboardAsHome(
   db: DatabaseInstance,
   dashboardId: string,
   teamId: string,
) {
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
   db: DatabaseInstance,
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
