import dayjs from "dayjs";
import { AppError, validateInput } from "@core/logging/errors";
import { and, asc, count, desc, eq, inArray, sum } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateContactInput,
   type UpdateContactInput,
   type ContactType,
   contacts,
   createContactSchema,
   updateContactSchema,
} from "@core/database/schemas/contacts";
import { transactions } from "@core/database/schemas/transactions";

const safeValidateCreate = fromThrowable(
   (data: CreateContactInput) => validateInput(createContactSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateContactInput) => validateInput(updateContactSchema, data),
   (e) =>
      e instanceof AppError
         ? e
         : AppError.validation("Dados inválidos.", { cause: e }),
);

export function createContact(
   db: DatabaseInstance,
   teamId: string,
   data: CreateContactInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .insert(contacts)
            .values({ ...validated, teamId })
            .returning(),
         (e) => AppError.database("Falha ao criar contato.", { cause: e }),
      ).andThen(([contact]) =>
         contact
            ? ok(contact)
            : err(AppError.database("Falha ao criar contato.")),
      ),
   );
}

export function listContacts(
   db: DatabaseInstance,
   teamId: string,
   type?: ContactType,
   includeArchived = false,
) {
   const conditions = [eq(contacts.teamId, teamId)];
   if (type) conditions.push(eq(contacts.type, type));
   if (!includeArchived) conditions.push(eq(contacts.isArchived, false));
   return fromPromise(
      db
         .select()
         .from(contacts)
         .where(and(...conditions))
         .orderBy(contacts.name),
      (e) => AppError.database("Falha ao listar contatos.", { cause: e }),
   );
}

export function getContact(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.select().from(contacts).where(eq(contacts.id, id)),
      (e) => AppError.database("Falha ao buscar contato.", { cause: e }),
   ).map(([contact]) => contact ?? null);
}

export function updateContact(
   db: DatabaseInstance,
   id: string,
   data: UpdateContactInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db
            .update(contacts)
            .set({ ...validated, updatedAt: dayjs().toDate() })
            .where(eq(contacts.id, id))
            .returning(),
         (e) => AppError.database("Falha ao atualizar contato.", { cause: e }),
      ).andThen(([updated]) =>
         updated
            ? ok(updated)
            : err(AppError.notFound("Contato não encontrado.")),
      ),
   );
}

export function archiveContact(db: DatabaseInstance, id: string) {
   return fromPromise(
      db
         .update(contacts)
         .set({ isArchived: true, updatedAt: dayjs().toDate() })
         .where(eq(contacts.id, id))
         .returning(),
      (e) => AppError.database("Falha ao arquivar contato.", { cause: e }),
   ).andThen(([updated]) =>
      updated ? ok(updated) : err(AppError.notFound("Contato não encontrado.")),
   );
}

export function reactivateContact(db: DatabaseInstance, id: string) {
   return fromPromise(
      db
         .update(contacts)
         .set({ isArchived: false, updatedAt: dayjs().toDate() })
         .where(eq(contacts.id, id))
         .returning(),
      (e) => AppError.database("Falha ao reativar contato.", { cause: e }),
   ).andThen(([updated]) =>
      updated ? ok(updated) : err(AppError.notFound("Contato não encontrado.")),
   );
}

export function contactHasLinks(db: DatabaseInstance, id: string) {
   return fromPromise(
      db
         .select({ total: count() })
         .from(transactions)
         .where(eq(transactions.contactId, id)),
      (e) =>
         AppError.database("Falha ao verificar vínculos do contato.", {
            cause: e,
         }),
   ).map(([result]) => (result?.total ?? 0) > 0);
}

export function deleteContact(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.select().from(contacts).where(eq(contacts.id, id)),
      (e) => AppError.database("Falha ao excluir contato.", { cause: e }),
   )
      .andThen(([contact]) =>
         contact
            ? ok(contact)
            : err(AppError.notFound("Contato não encontrado.")),
      )
      .andThen(() => contactHasLinks(db, id))
      .andThen((hasLinks) =>
         hasLinks
            ? err(
                 AppError.conflict(
                    "Contato possui lançamentos vinculados. Arquive em vez de excluir.",
                 ),
              )
            : ok(undefined),
      )
      .andThen(() =>
         fromPromise(db.delete(contacts).where(eq(contacts.id, id)), (e) =>
            AppError.database("Falha ao excluir contato.", { cause: e }),
         ),
      );
}

export function bulkDeleteContacts(
   db: DatabaseInstance,
   ids: string[],
   teamId: string,
) {
   return fromPromise(
      db
         .select({ id: contacts.id })
         .from(contacts)
         .where(and(inArray(contacts.id, ids), eq(contacts.teamId, teamId))),
      (e) => AppError.database("Falha ao excluir contatos.", { cause: e }),
   )
      .andThen((existing) =>
         existing.length !== ids.length
            ? err(
                 AppError.notFound(
                    "Um ou mais contatos não foram encontrados.",
                 ),
              )
            : ok(undefined),
      )
      .andThen(() =>
         fromPromise(
            (async () => {
               const results = await Promise.allSettled(
                  ids.map(async (id) => {
                     const [result] = await db
                        .select({ total: count() })
                        .from(transactions)
                        .where(eq(transactions.contactId, id));
                     if ((result?.total ?? 0) > 0)
                        throw AppError.conflict(
                           "Contato possui lançamentos vinculados. Arquive em vez de excluir.",
                        );
                     await db.delete(contacts).where(eq(contacts.id, id));
                  }),
               );
               const failed = results.filter(
                  (r) => r.status === "rejected",
               ).length;
               if (failed > 0)
                  throw AppError.database(
                     `${failed} contato(s) não puderam ser excluídos.`,
                  );
            })(),
            (e) =>
               e instanceof AppError
                  ? e
                  : AppError.database("Falha ao excluir contatos.", {
                       cause: e,
                    }),
         ),
      );
}

export function ensureContactOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return getContact(db, id).andThen((contact) => {
      if (!contact || contact.teamId !== teamId)
         return err(AppError.notFound("Contato não encontrado."));
      return ok(contact);
   });
}

export function getContactByExternalId(
   db: DatabaseInstance,
   externalId: string,
   teamId: string,
   type?: ContactType,
) {
   const conditions = [
      eq(contacts.externalId, externalId),
      eq(contacts.teamId, teamId),
   ];
   if (type) conditions.push(eq(contacts.type, type));
   return fromPromise(
      db
         .select()
         .from(contacts)
         .where(and(...conditions)),
      (e) => AppError.database("Falha ao buscar contato.", { cause: e }),
   ).map(([contact]) => contact ?? null);
}

export function listContactsPaginated(
   db: DatabaseInstance,
   teamId: string,
   options: {
      page: number;
      limit: number;
      type?: ContactType;
      includeArchived?: boolean;
   },
) {
   const { page, limit, type, includeArchived = false } = options;
   const conditions = [eq(contacts.teamId, teamId)];
   if (type) conditions.push(eq(contacts.type, type));
   if (!includeArchived) conditions.push(eq(contacts.isArchived, false));
   const where = and(...conditions);
   return fromPromise(
      (async () => {
         const [totalResult] = await db
            .select({ value: count() })
            .from(contacts)
            .where(where);
         const total = totalResult?.value ?? 0;
         const items = await db
            .select()
            .from(contacts)
            .where(where)
            .orderBy(asc(contacts.name))
            .limit(limit)
            .offset((page - 1) * limit);
         return { items, total };
      })(),
      (e) => AppError.database("Falha ao listar contatos.", { cause: e }),
   );
}

export function getContactTransactions(
   db: DatabaseInstance,
   contactId: string,
   teamId: string,
   options: { page: number; limit: number },
) {
   const { page, limit } = options;
   return fromPromise(
      (async () => {
         const where = and(
            eq(transactions.contactId, contactId),
            eq(transactions.teamId, teamId),
         );
         const [totalResult] = await db
            .select({ value: count() })
            .from(transactions)
            .where(where);
         const total = totalResult?.value ?? 0;
         const items = await db
            .select()
            .from(transactions)
            .where(where)
            .orderBy(desc(transactions.date))
            .limit(limit)
            .offset((page - 1) * limit);
         return { items, total };
      })(),
      (e) =>
         AppError.database("Falha ao listar transações do contato.", {
            cause: e,
         }),
   );
}

export function getContactTransactionStats(
   db: DatabaseInstance,
   contactId: string,
   teamId: string,
) {
   return fromPromise(
      (async () => {
         const where = and(
            eq(transactions.contactId, contactId),
            eq(transactions.teamId, teamId),
         );
         const [incomeResult] = await db
            .select({ total: sum(transactions.amount) })
            .from(transactions)
            .where(and(where, eq(transactions.type, "income")));
         const [expenseResult] = await db
            .select({ total: sum(transactions.amount) })
            .from(transactions)
            .where(and(where, eq(transactions.type, "expense")));
         return {
            totalIncome: incomeResult?.total ?? "0",
            totalExpense: expenseResult?.total ?? "0",
         };
      })(),
      (e) =>
         AppError.database("Falha ao buscar estatísticas do contato.", {
            cause: e,
         }),
   );
}
