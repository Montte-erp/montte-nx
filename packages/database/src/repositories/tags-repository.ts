import { AppError, propagateError } from "@packages/utils/errors";
import { eq } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { type NewTag, tags } from "../schema";

export async function createTag(db: DatabaseInstance, data: NewTag) {
   try {
      const [tag] = await db.insert(tags).values(data).returning();
      return tag;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create tag");
   }
}

export async function listTags(db: DatabaseInstance, teamId: string) {
   try {
      return await db
         .select()
         .from(tags)
         .where(eq(tags.teamId, teamId))
         .orderBy(tags.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list tags");
   }
}

export async function getTag(db: DatabaseInstance, id: string) {
   try {
      const [tag] = await db.select().from(tags).where(eq(tags.id, id));
      return tag ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get tag");
   }
}

export async function updateTag(
   db: DatabaseInstance,
   id: string,
   data: Partial<NewTag>,
) {
   try {
      const [updated] = await db
         .update(tags)
         .set(data)
         .where(eq(tags.id, id))
         .returning();
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update tag");
   }
}

export async function deleteTag(db: DatabaseInstance, id: string) {
   try {
      await db.delete(tags).where(eq(tags.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete tag");
   }
}
