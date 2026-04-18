import dayjs from "dayjs";
import { AppError, validateInput } from "@core/logging/errors";
import { eq, inArray } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateTagInput,
   type UpdateTagInput,
   tags,
   createTagSchema,
   updateTagSchema,
} from "@core/database/schemas/tags";

const safeValidateCreate = fromThrowable(
   (data: CreateTagInput) => validateInput(createTagSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateTagInput) => validateInput(updateTagSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

export function createTag(
   db: DatabaseInstance,
   teamId: string,
   data: CreateTagInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .insert(tags)
            .values({ ...validated, teamId })
            .returning(),
         (e) =>
            AppError.database("Falha ao criar centro de custo.", { cause: e }),
      ).andThen(([tag]) =>
         tag
            ? ok(tag)
            : err(AppError.database("Falha ao criar centro de custo.")),
      ),
   );
}

export function listTags(
   db: DatabaseInstance,
   teamId: string,
   opts?: { includeArchived?: boolean },
) {
   const query = opts?.includeArchived
      ? db.query.tags.findMany({
           where: (fields, { eq }) => eq(fields.teamId, teamId),
           orderBy: (fields, { asc }) => [asc(fields.name)],
        })
      : db.query.tags.findMany({
           where: (fields, { and, eq }) =>
              and(eq(fields.teamId, teamId), eq(fields.isArchived, false)),
           orderBy: (fields, { asc }) => [asc(fields.name)],
        });

   return fromPromise(query, (e) =>
      AppError.database("Falha ao listar centros de custo.", { cause: e }),
   );
}

export function getTag(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.tags.findFirst({ where: (fields, { eq }) => eq(fields.id, id) }),
      (e) =>
         AppError.database("Falha ao buscar centro de custo.", { cause: e }),
   ).map((tag) => tag ?? null);
}

export function updateTag(
   db: DatabaseInstance,
   id: string,
   data: UpdateTagInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(tags)
            .set({ ...validated, updatedAt: dayjs().toDate() })
            .where(eq(tags.id, id))
            .returning(),
         (e) =>
            AppError.database("Falha ao atualizar centro de custo.", {
               cause: e,
            }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Centro de custo não encontrado.")),
      ),
   );
}

export function archiveTag(db: DatabaseInstance, id: string) {
   return fromPromise(
      db
         .update(tags)
         .set({ isArchived: true, updatedAt: dayjs().toDate() })
         .where(eq(tags.id, id))
         .returning(),
      (e) =>
         AppError.database("Falha ao arquivar centro de custo.", { cause: e }),
   ).andThen(([updated]) =>
      updated
         ? ok(updated)
         : err(AppError.notFound("Centro de custo não encontrado.")),
   );
}

export function reactivateTag(db: DatabaseInstance, id: string) {
   return fromPromise(
      db
         .update(tags)
         .set({ isArchived: false, updatedAt: dayjs().toDate() })
         .where(eq(tags.id, id))
         .returning(),
      (e) =>
         AppError.database("Falha ao reativar centro de custo.", { cause: e }),
   ).andThen(([updated]) =>
      updated
         ? ok(updated)
         : err(AppError.notFound("Centro de custo não encontrado.")),
   );
}

export function tagHasTransactions(db: DatabaseInstance, tagId: string) {
   return fromPromise(
      db.query.transactions.findFirst({
         where: (fields, { eq }) => eq(fields.tagId, tagId),
         columns: { id: true },
      }),
      (e) =>
         AppError.database(
            "Falha ao verificar lançamentos do centro de custo.",
            { cause: e },
         ),
   ).map((row) => row !== undefined);
}

export function deleteTag(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.tags.findFirst({ where: (fields, { eq }) => eq(fields.id, id) }),
      (e) =>
         AppError.database("Falha ao excluir centro de custo.", { cause: e }),
   )
      .andThen((existing) => {
         if (!existing)
            return err(AppError.notFound("Centro de custo não encontrado."));
         if (existing.isDefault)
            return err(
               AppError.forbidden(
                  "Centro de custo padrão não pode ser excluído.",
               ),
            );
         return ok(existing);
      })
      .andThen(() => tagHasTransactions(db, id))
      .andThen((hasTransactions) =>
         hasTransactions
            ? err(
                 AppError.conflict(
                    "Centro de custo com lançamentos não pode ser excluído. Use arquivamento.",
                 ),
              )
            : ok(undefined),
      )
      .andThen(() =>
         fromPromise(db.delete(tags).where(eq(tags.id, id)), (e) =>
            AppError.database("Falha ao excluir centro de custo.", {
               cause: e,
            }),
         ),
      );
}

export function bulkDeleteTags(
   db: DatabaseInstance,
   ids: string[],
   teamId: string,
) {
   return fromPromise(
      db.query.tags.findMany({
         where: (fields, { and, inArray, eq }) =>
            and(inArray(fields.id, ids), eq(fields.teamId, teamId)),
      }),
      (e) =>
         AppError.database("Falha ao excluir centros de custo.", { cause: e }),
   )
      .andThen((existing) => {
         if (existing.length !== ids.length)
            return err(
               AppError.notFound(
                  "Um ou mais centros de custo não foram encontrados.",
               ),
            );
         if (existing.some((t) => t.isDefault))
            return err(
               AppError.forbidden(
                  "Centros de custo padrão não podem ser excluídos.",
               ),
            );
         return ok(undefined);
      })
      .andThen(() =>
         fromPromise(
            db.query.transactions.findFirst({
               where: (fields, { inArray }) => inArray(fields.tagId, ids),
               columns: { id: true },
            }),
            (e) =>
               AppError.database("Falha ao excluir centros de custo.", {
                  cause: e,
               }),
         ),
      )
      .andThen((withTransaction) =>
         withTransaction
            ? err(
                 AppError.conflict(
                    "Centros de custo com lançamentos não podem ser excluídos. Use arquivamento.",
                 ),
              )
            : ok(undefined),
      )
      .andThen(() =>
         fromPromise(db.delete(tags).where(inArray(tags.id, ids)), (e) =>
            AppError.database("Falha ao excluir centros de custo.", {
               cause: e,
            }),
         ),
      );
}

export function ensureTagOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getTag(db, id).andThen((tag) => {
      if (!tag || tag.teamId !== teamId)
         return err(AppError.notFound("Centro de custo não encontrado."));
      return ok(tag);
   });
}
