import { AppError, propagateError } from "@core/logging/errors";
import { eq } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import { contactSettings } from "@core/database/schemas/contact-settings";

export async function getContactSettings(db: DatabaseInstance, teamId: string) {
   try {
      const [settings] = await db
         .select()
         .from(contactSettings)
         .where(eq(contactSettings.teamId, teamId));
      return settings ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get contact settings");
   }
}

export async function upsertContactSettings(
   db: DatabaseInstance,
   teamId: string,
   data: Partial<
      Omit<
         typeof contactSettings.$inferInsert,
         "teamId" | "createdAt" | "updatedAt"
      >
   >,
) {
   try {
      const [settings] = await db
         .insert(contactSettings)
         .values({ teamId, ...data })
         .onConflictDoUpdate({
            target: contactSettings.teamId,
            set: { ...data, updatedAt: new Date() },
         })
         .returning();
      if (!settings)
         throw AppError.database("Failed to upsert contact settings");
      return settings;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to upsert contact settings");
   }
}
