import { AppError, propagateError } from "@core/logging/errors";
import { eq } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import { financialSettings } from "@core/database/schemas/financial";

export async function getFinancialSettings(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      const [settings] = await db
         .select()
         .from(financialSettings)
         .where(eq(financialSettings.teamId, teamId));
      return settings ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get financial settings");
   }
}

export async function upsertFinancialSettings(
   db: DatabaseInstance,
   teamId: string,
   data: Partial<
      Omit<
         typeof financialSettings.$inferInsert,
         "teamId" | "createdAt" | "updatedAt"
      >
   >,
) {
   try {
      const [settings] = await db
         .insert(financialSettings)
         .values({ teamId, ...data })
         .onConflictDoUpdate({
            target: financialSettings.teamId,
            set: { ...data, updatedAt: new Date() },
         })
         .returning();
      if (!settings)
         throw AppError.database("Failed to upsert financial settings");
      return settings;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to upsert financial settings");
   }
}
