import dayjs from "dayjs";
import { AppError, validateInput } from "@core/logging/errors";
import { eq, inArray } from "drizzle-orm";
import { fromPromise, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateTagInput,
   type UpdateTagInput,
   tags,
   createTagSchema,
   updateTagSchema,
} from "@core/database/schemas/tags";

export function createTag(
   db: DatabaseInstance,
   teamId: string,
   data: CreateTagInput,
) {
   return fromPromise(
      (async () => {
         const validated = validateInput(createTagSchema, data);
         const [tag] = await db
            .insert(tags)
            .values({ ...validated, teamId })
            .returning();
         if (!tag) throw AppError.database("Failed to create tag");
         return tag;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to create tag", { cause: e }),
   );
}

export function listTags(
   db: DatabaseInstance,
   teamId: string,
   opts?: { includeArchived?: boolean },
) {
   return fromPromise(
      (async () => {
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
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to list tags", { cause: e }),
   );
}

export function getTag(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.tags.findFirst({ where: (fields, { eq }) => eq(fields.id, id) }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to get tag", { cause: e }),
   ).map((tag) => tag ?? null);
}

export function updateTag(
   db: DatabaseInstance,
   id: string,
   data: UpdateTagInput,
) {
   return fromPromise(
      (async () => {
         const validated = validateInput(updateTagSchema, data);
         const [updated] = await db
            .update(tags)
            .set({ ...validated, updatedAt: dayjs().toDate() })
            .where(eq(tags.id, id))
            .returning();
         if (!updated) throw AppError.notFound("Tag não encontrada.");
         return updated;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to update tag", { cause: e }),
   );
}

export function archiveTag(db: DatabaseInstance, id: string) {
   return fromPromise(
      (async () => {
         const [updated] = await db
            .update(tags)
            .set({ isArchived: true, updatedAt: dayjs().toDate() })
            .where(eq(tags.id, id))
            .returning();
         if (!updated) throw AppError.notFound("Tag não encontrada.");
         return updated;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to archive tag", { cause: e }),
   );
}

export function reactivateTag(db: DatabaseInstance, id: string) {
   return fromPromise(
      (async () => {
         const [updated] = await db
            .update(tags)
            .set({ isArchived: false, updatedAt: dayjs().toDate() })
            .where(eq(tags.id, id))
            .returning();
         if (!updated) throw AppError.notFound("Tag não encontrada.");
         return updated;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to reactivate tag", { cause: e }),
   );
}

export function tagHasTransactions(db: DatabaseInstance, tagId: string) {
   return fromPromise(
      db.query.transactions.findFirst({
         where: (fields, { eq }) => eq(fields.tagId, tagId),
         columns: { id: true },
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to check tag transactions", {
                 cause: e,
              }),
   ).map((row) => row !== undefined);
}

export function deleteTag(db: DatabaseInstance, id: string) {
   return fromPromise(
      (async () => {
         const existing = await db.query.tags.findFirst({
            where: (fields, { eq }) => eq(fields.id, id),
         });
         if (!existing) throw AppError.notFound("Tag não encontrada.");

         const hasResult = await tagHasTransactions(db, id);
         if (hasResult.isErr()) throw hasResult.error;
         if (hasResult.value) {
            throw AppError.conflict(
               "Tag com lançamentos não pode ser excluída. Use arquivamento.",
            );
         }

         await db.delete(tags).where(eq(tags.id, id));
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to delete tag", { cause: e }),
   );
}

export function bulkDeleteTags(
   db: DatabaseInstance,
   ids: string[],
   teamId: string,
) {
   return fromPromise(
      (async () => {
         const existing = await db.query.tags.findMany({
            where: (fields, { and, inArray, eq }) =>
               and(inArray(fields.id, ids), eq(fields.teamId, teamId)),
         });
         if (existing.length !== ids.length) {
            throw AppError.notFound("Uma ou mais tags não foram encontradas.");
         }
         const withTransaction = await db.query.transactions.findFirst({
            where: (fields, { inArray }) => inArray(fields.tagId, ids),
            columns: { id: true },
         });
         if (withTransaction) {
            throw AppError.conflict(
               "Centros de custo com lançamentos não podem ser excluídos. Use arquivamento.",
            );
         }
         await db.delete(tags).where(inArray(tags.id, ids));
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to bulk delete tags", { cause: e }),
   );
}

export function ensureTagOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getTag(db, id).andThen((tag) => {
      if (!tag || tag.teamId !== teamId)
         return err(AppError.notFound("Tag não encontrada."));
      return ok(tag);
   });
}
