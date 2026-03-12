import type { DatabaseInstance } from "@core/database/client";
import { dashboards } from "@core/database/schemas/dashboards";
import { insights } from "@core/database/schemas/insights";
import { AppError, propagateError } from "@core/logging/errors";
import { DEFAULT_INSIGHTS } from "./defaults";

export async function createDefaultInsights(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   userId: string,
): Promise<string[]> {
   try {
      const insightRecords = DEFAULT_INSIGHTS.map((def) => ({
         organizationId,
         teamId,
         createdBy: userId,
         name: def.name,
         description: def.description,
         type: def.type,
         config: def.config as Record<string, unknown>,
         defaultSize: def.defaultSize,
      }));

      const created = await db
         .insert(insights)
         .values(insightRecords)
         .returning({ id: insights.id });

      return created.map((r) => r.id);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create default insights");
   }
}

export async function createDefaultDashboard(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   userId: string,
   name: string,
   insightIds: string[],
) {
   try {
      const tiles = insightIds.map((insightId, index) => ({
         insightId,
         size: DEFAULT_INSIGHTS[index]!.defaultSize,
         order: index,
      }));

      const [dashboard] = await db
         .insert(dashboards)
         .values({
            organizationId,
            teamId,
            createdBy: userId,
            name,
            description: null,
            isDefault: true,
            tiles,
         })
         .returning();

      return dashboard;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create default dashboard");
   }
}
