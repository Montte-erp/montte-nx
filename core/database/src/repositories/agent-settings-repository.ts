import { AppError, propagateError } from "@core/logging/errors";
import { eq } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import { agentSettings } from "@core/database/schemas/agents";

export async function getAgentSettings(db: DatabaseInstance, teamId: string) {
   try {
      const [settings] = await db
         .select()
         .from(agentSettings)
         .where(eq(agentSettings.teamId, teamId));
      return settings ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get agent settings");
   }
}

export async function upsertAgentSettings(
   db: DatabaseInstance,
   teamId: string,
   data: Omit<
      typeof agentSettings.$inferInsert,
      "teamId" | "createdAt" | "updatedAt"
   >,
) {
   try {
      const [settings] = await db
         .insert(agentSettings)
         .values({ teamId, ...data })
         .onConflictDoUpdate({
            target: agentSettings.teamId,
            set: { ...data, updatedAt: new Date() },
         })
         .returning();
      if (!settings) throw AppError.database("Failed to upsert agent settings");
      return settings;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to upsert agent settings");
   }
}
