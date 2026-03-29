import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { eq, sql } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateTagInput,
   type UpdateTagInput,
   tags,
   createTagSchema,
   updateTagSchema,
} from "@core/database/schemas/tags";
import { transactionTags } from "@core/database/schemas/transactions";

export async function createTag(
   db: DatabaseInstance,
   teamId: string,
   data: CreateTagInput,
) {
   const validated = validateInput(createTagSchema, data);
   try {
      const [tag] = await db
         .insert(tags)
         .values({
            ...validated,
            teamId,
         })
         .returning();
      if (!tag) throw AppError.database("Failed to create tag");
      return tag;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create tag");
   }
}

export async function listTags(
   db: DatabaseInstance,
   teamId: string,
   opts?: { includeArchived?: boolean },
) {
   try {
      if (opts?.includeArchived) {
         return await db.query.tags.findMany({
            where: (fields, { eq }) => eq(fields.teamId, teamId),
            orderBy: (fields, { asc }) => [asc(fields.name)],
         });
      }
      return await db.query.tags.findMany({
         where: (fields, { and, eq }) =>
            and(eq(fields.teamId, teamId), eq(fields.isArchived, false)),
         orderBy: (fields, { asc }) => [asc(fields.name)],
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list tags");
   }
}

export async function getTag(db: DatabaseInstance, id: string) {
   try {
      const tag = await db.query.tags.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      });
      return tag ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get tag");
   }
}

export async function updateTag(
   db: DatabaseInstance,
   id: string,
   data: UpdateTagInput,
) {
   const validated = validateInput(updateTagSchema, data);
   try {
      const [updated] = await db
         .update(tags)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(tags.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Tag não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update tag");
   }
}

export async function archiveTag(db: DatabaseInstance, id: string) {
   try {
      const [updated] = await db
         .update(tags)
         .set({ isArchived: true, updatedAt: new Date() })
         .where(eq(tags.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Tag não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive tag");
   }
}

export async function reactivateTag(db: DatabaseInstance, id: string) {
   try {
      const [updated] = await db
         .update(tags)
         .set({ isArchived: false, updatedAt: new Date() })
         .where(eq(tags.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Tag não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to reactivate tag");
   }
}

export async function deleteTag(db: DatabaseInstance, id: string) {
   try {
      const existing = await db.query.tags.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      });
      if (!existing) throw AppError.notFound("Tag não encontrada.");

      const hasTransactions = await tagHasTransactions(db, id);
      if (hasTransactions) {
         throw AppError.conflict(
            "Tag com lançamentos não pode ser excluída. Use arquivamento.",
         );
      }

      await db.delete(tags).where(eq(tags.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete tag");
   }
}

export async function ensureTagOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   const tag = await getTag(db, id);
   if (!tag || tag.teamId !== teamId) {
      throw AppError.notFound("Tag não encontrada.");
   }
   return tag;
}

export async function tagHasTransactions(
   db: DatabaseInstance,
   tagId: string,
): Promise<boolean> {
   try {
      const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactionTags)
         .where(eq(transactionTags.tagId, tagId));
      return (row?.count ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check tag transactions");
   }
}
