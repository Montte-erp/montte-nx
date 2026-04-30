import dayjs from "dayjs";
import { and, count, desc, eq, inArray, min, sum } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import { billingContract } from "../contracts/billing-contract";
import { implementerInternal } from "@orpc/server";
import type { DatabaseInstance } from "@core/database/client";
import { contacts } from "@core/database/schemas/contacts";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import type {
   ORPCContext,
   ORPCContextWithOrganization,
} from "@core/orpc/server";

const def = protectedProcedure["~orpc"];
const impl = implementerInternal<
   typeof billingContract.contacts,
   ORPCContext,
   ORPCContextWithOrganization
>(billingContract.contacts, def.config, [...def.middlewares]);

const findContactByRef = (
   db: DatabaseInstance,
   teamId: string,
   ref: { id: string } | { externalId: string },
) =>
   fromPromise(
      db.query.contacts.findFirst({
         where: (f, { and: andFn, eq: eqFn }) =>
            "id" in ref
               ? andFn(eqFn(f.id, ref.id), eqFn(f.teamId, teamId))
               : andFn(
                    eqFn(f.externalId, ref.externalId),
                    eqFn(f.teamId, teamId),
                 ),
      }),
      () => WebAppError.internal("Falha ao verificar permissão."),
   );

export const create = impl.create.handler(async ({ context, input }) => {
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
   );
   if (result.isErr()) throw result.error;
   if (!result.value)
      throw WebAppError.internal(
         "Falha ao criar contato: insert retornou vazio.",
      );
   return result.value;
});

export const getAll = impl.getAll.handler(async ({ context, input }) => {
   const result = await fromPromise(
      context.db.query.contacts.findMany({
         where: (f, { and: andFn, eq: eqFn }) => {
            const conditions = [
               eqFn(f.teamId, context.teamId),
               eqFn(f.isArchived, false),
            ];
            if (input?.type) conditions.push(eqFn(f.type, input.type));
            return andFn(...conditions);
         },
         orderBy: (f, { asc: ascFn }) => [ascFn(f.name)],
      }),
      () => WebAppError.internal("Falha ao listar contatos."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const getById = impl.getById
   .use(async ({ context, next }, input) => {
      const result = (
         await findContactByRef(context.db, context.teamId, input)
      ).andThen((contact) =>
         !contact
            ? err(WebAppError.notFound("Contato não encontrado."))
            : ok(contact),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { contact: result.value } });
   })
   .handler(({ context }) => context.contact);

export const archive = impl.archive
   .use(async ({ context, next }, input) => {
      const result = (
         await findContactByRef(context.db, context.teamId, input)
      ).andThen((contact) =>
         !contact
            ? err(WebAppError.notFound("Contato não encontrado."))
            : ok(contact),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { contact: result.value } });
   })
   .handler(async ({ context }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(contacts)
               .set({ isArchived: true, updatedAt: dayjs().toDate() })
               .where(eq(contacts.id, context.contact.id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao arquivar contato."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao arquivar contato: update retornou vazio.",
         );
      return result.value;
   });

export const reactivate = impl.reactivate
   .use(async ({ context, next }, input) => {
      const result = (
         await findContactByRef(context.db, context.teamId, input)
      ).andThen((contact) =>
         !contact
            ? err(WebAppError.notFound("Contato não encontrado."))
            : ok(contact),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { contact: result.value } });
   })
   .handler(async ({ context }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(contacts)
               .set({ isArchived: false, updatedAt: dayjs().toDate() })
               .where(eq(contacts.id, context.contact.id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao reativar contato."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao reativar contato: update retornou vazio.",
         );
      return result.value;
   });

export const remove = impl.remove
   .use(async ({ context, next }, input) => {
      const result = (
         await findContactByRef(context.db, context.teamId, input)
      ).andThen((contact) =>
         !contact
            ? err(WebAppError.notFound("Contato não encontrado."))
            : ok(contact),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { contact: result.value } });
   })
   .handler(async ({ context }) => {
      const linksResult = await fromPromise(
         context.db
            .select({ total: count() })
            .from(transactions)
            .where(eq(transactions.contactId, context.contact.id)),
         () => WebAppError.internal("Falha ao verificar vínculos do contato."),
      );
      if (linksResult.isErr()) throw linksResult.error;
      const total = linksResult.value[0]?.total ?? 0;
      if (total > 0)
         throw WebAppError.conflict(
            "Contato possui lançamentos vinculados. Arquive em vez de excluir.",
         );

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .delete(contacts)
               .where(eq(contacts.id, context.contact.id));
         }),
         () => WebAppError.internal("Falha ao excluir contato."),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });

export const bulkRemove = impl.bulkRemove.handler(
   async ({ context, input }) => {
      const existing = await fromPromise(
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
      if (existing.isErr()) throw existing.error;
      if (existing.value.length !== input.ids.length)
         throw WebAppError.notFound(
            "Um ou mais contatos não foram encontrados.",
         );

      const linked = await fromPromise(
         context.db
            .select({ contactId: transactions.contactId })
            .from(transactions)
            .where(inArray(transactions.contactId, input.ids))
            .groupBy(transactions.contactId),
         () => WebAppError.internal("Falha ao excluir contatos."),
      );
      if (linked.isErr()) throw linked.error;
      if (linked.value.length > 0)
         throw WebAppError.conflict(
            "Contato possui lançamentos vinculados. Arquive em vez de excluir.",
         );

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(contacts).where(inArray(contacts.id, input.ids));
         }),
         () => WebAppError.internal("Falha ao excluir contatos."),
      );
      if (result.isErr()) throw result.error;
      return { deleted: input.ids.length };
   },
);

export const update = impl.update.handler(async ({ context, input }) => {
   const ref =
      "id" in input ? { id: input.id } : { externalId: input.externalId };
   const ownership = (
      await findContactByRef(context.db, context.teamId, ref)
   ).andThen((contact) =>
      !contact
         ? err(WebAppError.notFound("Contato não encontrado."))
         : ok(contact),
   );
   if (ownership.isErr()) throw ownership.error;

   const { name, email, phone, document } = input;
   const data: Record<string, unknown> = {};
   if (name !== undefined) data.name = name;
   if (email !== undefined) data.email = email;
   if (phone !== undefined) data.phone = phone;
   if (document !== undefined) data.document = document;

   const result = await fromPromise(
      context.db.transaction(async (tx) => {
         const [row] = await tx
            .update(contacts)
            .set({ ...data, updatedAt: dayjs().toDate() })
            .where(eq(contacts.id, ownership.value.id))
            .returning();
         return row;
      }),
      () => WebAppError.internal("Falha ao atualizar contato."),
   );
   if (result.isErr()) throw result.error;
   if (!result.value)
      throw WebAppError.internal(
         "Falha ao atualizar contato: update retornou vazio.",
      );
   return result.value;
});

export const getStats = impl.getStats
   .use(async ({ context, next }, input) => {
      const result = (
         await findContactByRef(context.db, context.teamId, input)
      ).andThen((contact) =>
         !contact
            ? err(WebAppError.notFound("Contato não encontrado."))
            : ok(contact),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { contact: result.value } });
   })
   .handler(async ({ context }) => {
      const id = context.contact.id;
      const result = await fromPromise(
         (async () => {
            const where = and(
               eq(transactions.contactId, id),
               eq(transactions.teamId, context.teamId),
            );
            const [incomeResult] = await context.db
               .select({ total: sum(transactions.amount) })
               .from(transactions)
               .where(and(where, eq(transactions.type, "income")));
            const [expenseResult] = await context.db
               .select({ total: sum(transactions.amount) })
               .from(transactions)
               .where(and(where, eq(transactions.type, "expense")));
            const [firstTxResult] = await context.db
               .select({ date: min(transactions.date) })
               .from(transactions)
               .where(where);
            return {
               totalIncome: incomeResult?.total ?? "0",
               totalExpense: expenseResult?.total ?? "0",
               firstTransactionDate: firstTxResult?.date ?? null,
            };
         })(),
         () => WebAppError.internal("Falha ao buscar estatísticas do contato."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getTransactions = impl.getTransactions.handler(
   async ({ context, input }) => {
      const ref =
         "id" in input ? { id: input.id } : { externalId: input.externalId };
      const ownership = (
         await findContactByRef(context.db, context.teamId, ref)
      ).andThen((contact) =>
         !contact
            ? err(WebAppError.notFound("Contato não encontrado."))
            : ok(contact),
      );
      if (ownership.isErr()) throw ownership.error;
      const contactId = ownership.value.id;
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 20;

      const result = await fromPromise(
         (async () => {
            const where = and(
               eq(transactions.contactId, contactId),
               eq(transactions.teamId, context.teamId),
            );
            const [totalResult] = await context.db
               .select({ value: count() })
               .from(transactions)
               .where(where);
            const total = totalResult?.value ?? 0;
            const items = await context.db
               .select()
               .from(transactions)
               .where(where)
               .orderBy(desc(transactions.date))
               .limit(pageSize)
               .offset((page - 1) * pageSize);
            return { items, total };
         })(),
         () => WebAppError.internal("Falha ao listar transações do contato."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   },
);
