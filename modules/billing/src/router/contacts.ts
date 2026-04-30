import dayjs from "dayjs";
import { and, count, desc, eq, inArray, min, sum } from "drizzle-orm";
import { errAsync, fromPromise, okAsync, safeTry } from "neverthrow";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import {
   contacts,
   contactTypeEnum,
   createContactSchema,
   updateContactSchema,
} from "@core/database/schemas/contacts";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   contactByIdRefSchema,
   type ContactRef,
} from "@modules/billing/router/middlewares";

const listInputSchema = z
   .object({
      type: z.enum(contactTypeEnum.enumValues).optional(),
   })
   .optional();

const paginationFields = {
   page: z.number().int().min(1).optional(),
   pageSize: z.number().int().min(1).max(100).optional(),
} as const;

const transactionsInputSchema = z.union([
   z.object({ id: z.string().uuid(), ...paginationFields }),
   z.object({ externalId: z.string().min(1), ...paginationFields }),
]);

const updatableContactFields = updateContactSchema.pick({
   name: true,
   email: true,
   phone: true,
   document: true,
});

const updateInputSchema = z.union([
   z.object({ id: z.string().uuid() }).merge(updatableContactFields),
   z.object({ externalId: z.string().min(1) }).merge(updatableContactFields),
]);

const bulkRemoveInputSchema = z.object({
   ids: z.array(z.string().uuid()).min(1),
});

const findByRef = (db: DatabaseInstance, teamId: string, ref: ContactRef) =>
   fromPromise(
      db.query.contacts.findFirst({
         where: (f, { and: andFn, eq: eqFn }) =>
            "id" in ref
               ? andFn(eqFn(f.teamId, teamId), eqFn(f.id, ref.id))
               : "contactId" in ref
                 ? andFn(eqFn(f.teamId, teamId), eqFn(f.id, ref.contactId))
                 : andFn(
                      eqFn(f.teamId, teamId),
                      eqFn(f.externalId, ref.externalId),
                   ),
      }),
      () => WebAppError.internal("Falha ao verificar permissão."),
   ).andThen((contact) =>
      contact
         ? okAsync(contact)
         : errAsync(WebAppError.notFound("Contato não encontrado.")),
   );

const ensureRow = <T>(row: T | undefined, message: string) =>
   row ? okAsync(row) : errAsync(WebAppError.internal(message));

const refFromInput = (
   input: { id: string } | { externalId: string },
): ContactRef =>
   "id" in input ? { id: input.id } : { externalId: input.externalId };

export const create = protectedProcedure
   .input(createContactSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(contacts)
               .values({
                  ...input,
                  type: input.type ?? "cliente",
                  teamId: context.teamId,
               })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar contato."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao criar contato: insert retornou vazio."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getAll = protectedProcedure
   .input(listInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.contacts.findMany({
            where: (f, { and: andFn, eq: eqFn }) =>
               andFn(
                  eqFn(f.teamId, context.teamId),
                  eqFn(f.isArchived, false),
                  input?.type ? eqFn(f.type, input.type) : undefined,
               ),
            orderBy: (f, { asc: ascFn }) => [ascFn(f.name)],
         }),
         () => WebAppError.internal("Falha ao listar contatos."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getById = protectedProcedure
   .input(contactByIdRefSchema)
   .handler(async ({ context, input }) => {
      const result = await findByRef(context.db, context.teamId, input);
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const archive = protectedProcedure
   .input(contactByIdRefSchema)
   .handler(async ({ context, input }) => {
      const result = await safeTry(async function* () {
         const contact = yield* findByRef(context.db, context.teamId, input);
         const row = yield* fromPromise(
            context.db.transaction(async (tx) => {
               const [updated] = await tx
                  .update(contacts)
                  .set({ isArchived: true, updatedAt: dayjs().toDate() })
                  .where(eq(contacts.id, contact.id))
                  .returning();
               return updated;
            }),
            () => WebAppError.internal("Falha ao arquivar contato."),
         );
         return ensureRow(
            row,
            "Falha ao arquivar contato: update retornou vazio.",
         );
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const reactivate = protectedProcedure
   .input(contactByIdRefSchema)
   .handler(async ({ context, input }) => {
      const result = await safeTry(async function* () {
         const contact = yield* findByRef(context.db, context.teamId, input);
         const row = yield* fromPromise(
            context.db.transaction(async (tx) => {
               const [updated] = await tx
                  .update(contacts)
                  .set({ isArchived: false, updatedAt: dayjs().toDate() })
                  .where(eq(contacts.id, contact.id))
                  .returning();
               return updated;
            }),
            () => WebAppError.internal("Falha ao reativar contato."),
         );
         return ensureRow(
            row,
            "Falha ao reativar contato: update retornou vazio.",
         );
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const remove = protectedProcedure
   .input(contactByIdRefSchema)
   .handler(async ({ context, input }) => {
      const result = await safeTry(async function* () {
         const contact = yield* findByRef(context.db, context.teamId, input);
         const links = yield* fromPromise(
            context.db
               .select({ total: count() })
               .from(transactions)
               .where(eq(transactions.contactId, contact.id)),
            () =>
               WebAppError.internal("Falha ao verificar vínculos do contato."),
         );
         const linkedCount = links[0]?.total ?? 0;
         if (linkedCount > 0)
            yield* errAsync(
               WebAppError.conflict(
                  "Contato possui lançamentos vinculados. Arquive em vez de excluir.",
               ),
            );
         yield* fromPromise(
            context.db.transaction(async (tx) => {
               await tx.delete(contacts).where(eq(contacts.id, contact.id));
            }),
            () => WebAppError.internal("Falha ao excluir contato."),
         );
         return okAsync({ success: true as const });
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const bulkRemove = protectedProcedure
   .input(bulkRemoveInputSchema)
   .handler(async ({ context, input }) => {
      const result = await safeTry(async function* () {
         const owned = yield* fromPromise(
            context.db
               .select({ id: contacts.id })
               .from(contacts)
               .where(
                  and(
                     inArray(contacts.id, input.ids),
                     eq(contacts.teamId, context.teamId),
                  ),
               ),
            () => WebAppError.internal("Falha ao excluir contatos."),
         );
         if (owned.length !== input.ids.length)
            yield* errAsync(
               WebAppError.notFound(
                  "Um ou mais contatos não foram encontrados.",
               ),
            );

         const linked = yield* fromPromise(
            context.db
               .select({ contactId: transactions.contactId })
               .from(transactions)
               .where(inArray(transactions.contactId, input.ids))
               .groupBy(transactions.contactId),
            () => WebAppError.internal("Falha ao excluir contatos."),
         );
         if (linked.length > 0)
            yield* errAsync(
               WebAppError.conflict(
                  "Contato possui lançamentos vinculados. Arquive em vez de excluir.",
               ),
            );

         yield* fromPromise(
            context.db.transaction(async (tx) => {
               await tx.delete(contacts).where(inArray(contacts.id, input.ids));
            }),
            () => WebAppError.internal("Falha ao excluir contatos."),
         );
         return okAsync({ deleted: input.ids.length });
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const update = protectedProcedure
   .input(updateInputSchema)
   .handler(async ({ context, input }) => {
      const result = await safeTry(async function* () {
         const contact = yield* findByRef(
            context.db,
            context.teamId,
            refFromInput(input),
         );
         const fields = updatableContactFields.parse(input);
         const row = yield* fromPromise(
            context.db.transaction(async (tx) => {
               const [updated] = await tx
                  .update(contacts)
                  .set({ ...fields, updatedAt: dayjs().toDate() })
                  .where(eq(contacts.id, contact.id))
                  .returning();
               return updated;
            }),
            () => WebAppError.internal("Falha ao atualizar contato."),
         );
         return ensureRow(
            row,
            "Falha ao atualizar contato: update retornou vazio.",
         );
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getStats = protectedProcedure
   .input(contactByIdRefSchema)
   .handler(async ({ context, input }) => {
      const result = await safeTry(async function* () {
         const contact = yield* findByRef(context.db, context.teamId, input);
         const where = and(
            eq(transactions.contactId, contact.id),
            eq(transactions.teamId, context.teamId),
         );
         const stats = yield* fromPromise(
            Promise.all([
               context.db
                  .select({ total: sum(transactions.amount) })
                  .from(transactions)
                  .where(and(where, eq(transactions.type, "income"))),
               context.db
                  .select({ total: sum(transactions.amount) })
                  .from(transactions)
                  .where(and(where, eq(transactions.type, "expense"))),
               context.db
                  .select({ date: min(transactions.date) })
                  .from(transactions)
                  .where(where),
            ]),
            () =>
               WebAppError.internal("Falha ao buscar estatísticas do contato."),
         );
         const [income, expense, firstTx] = stats;
         return okAsync({
            totalIncome: income[0]?.total ?? "0",
            totalExpense: expense[0]?.total ?? "0",
            firstTransactionDate: firstTx[0]?.date ?? null,
         });
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getTransactions = protectedProcedure
   .input(transactionsInputSchema)
   .handler(async ({ context, input }) => {
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 20;
      const result = await safeTry(async function* () {
         const contact = yield* findByRef(
            context.db,
            context.teamId,
            refFromInput(input),
         );
         const where = and(
            eq(transactions.contactId, contact.id),
            eq(transactions.teamId, context.teamId),
         );
         const data = yield* fromPromise(
            Promise.all([
               context.db
                  .select({ value: count() })
                  .from(transactions)
                  .where(where),
               context.db
                  .select()
                  .from(transactions)
                  .where(where)
                  .orderBy(desc(transactions.date))
                  .limit(pageSize)
                  .offset((page - 1) * pageSize),
            ]),
            () =>
               WebAppError.internal("Falha ao listar transações do contato."),
         );
         const [totalRows, items] = data;
         return okAsync({ items, total: totalRows[0]?.value ?? 0 });
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });
