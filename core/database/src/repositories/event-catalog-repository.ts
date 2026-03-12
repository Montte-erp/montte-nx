import { db, type DatabaseInstance } from "@core/database/client";
import { AppError, propagateError } from "@core/logging/errors";
import { eventCatalog } from "@core/database/schemas/event-catalog";
import { asc } from "drizzle-orm";

export async function listEventCatalog(database: DatabaseInstance = db) {
   try {
      return await database
         .select()
         .from(eventCatalog)
         .orderBy(asc(eventCatalog.eventName));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list event catalog");
   }
}
