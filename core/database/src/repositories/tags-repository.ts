import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { eq, sql } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateTagInput,
   type UpdateTagInput,
   tags,
   createTagSchema,
   updateTagSchema,
} from "@core/database/schemas/tags";
import { transactionTags } from "@core/database/schemas/transactions";

export async function createTag(teamId: string, data: CreateTagInput) {
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
   teamId: string,
   opts?: { includeArchived?: boolean },
) {
   try {
      if (opts?.includeArchived) {
         return await db.query.tags.findMany({
            where: { teamId },
            orderBy: { name: "asc" },
         });
      }
      return await db.query.tags.findMany({
         where: { teamId, isArchived: false },
         orderBy: { name: "asc" },
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list tags");
   }
}

export async function getTag(id: string) {
   try {
      const tag = await db.query.tags.findFirst({
         where: { id },
      });
      return tag ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get tag");
   }
}

export async function updateTag(id: string, data: UpdateTagInput) {
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

export async function archiveTag(id: string) {
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

export async function reactivateTag(id: string) {
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

export async function deleteTag(id: string) {
   try {
      const existing = await db.query.tags.findFirst({
         where: { id },
      });
      if (!existing) throw AppError.notFound("Tag não encontrada.");

      const hasTransactions = await tagHasTransactions(id);
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

export async function ensureTagOwnership(id: string, teamId: string) {
   const tag = await getTag(id);
   if (!tag || tag.teamId !== teamId) {
      throw AppError.notFound("Tag não encontrada.");
   }
   return tag;
}

export async function tagHasTransactions(tagId: string): Promise<boolean> {
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
