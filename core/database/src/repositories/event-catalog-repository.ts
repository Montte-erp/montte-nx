import type { DatabaseInstance } from "@core/database/client";
import { AppError, propagateError } from "@core/logging/errors";
import { eventCatalog } from "@core/database/schemas/event-catalog";
import { asc } from "drizzle-orm";

export async function listEventCatalog(db: DatabaseInstance) {
   try {
      return await db
         .select()
         .from(eventCatalog)
         .orderBy(asc(eventCatalog.eventName));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list event catalog");
   }
}
