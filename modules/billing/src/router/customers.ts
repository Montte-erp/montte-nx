import { implementerInternal } from "@orpc/server";
import dayjs from "dayjs";
import { and, asc, count, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { type Contact, contacts } from "@core/database/schemas/contacts";
import { WebAppError } from "@core/logging/errors";
import {
   type ORPCContext,
   type ORPCContextWithOrganization,
   protectedProcedure,
} from "@core/orpc/server";
import { hyprpayContract } from "@montte/hyprpay/contract";

const impl = implementerInternal<
   typeof hyprpayContract,
   ORPCContext,
   ORPCContextWithOrganization
>(hyprpayContract, protectedProcedure["~orpc"].config, [
   ...protectedProcedure["~orpc"].middlewares,
]);

function mapCustomer(contact: Contact) {
   return {
      ...contact,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
   };
}

export const create = impl.create.handler(async ({ context, input }) => {
   const result = await fromPromise(
      context.db.transaction(async (tx) => {
         const [row] = await tx
            .insert(contacts)
            .values({
               teamId: context.teamId,
               name: input.name,
               type: "cliente",
               email: input.email ?? null,
               phone: input.phone ?? null,
               document: input.document ?? null,
               externalId: input.externalId ?? null,
            })
            .returning();
         return row;
      }),
      () => WebAppError.internal("Falha ao criar cliente."),
   );
   if (result.isErr()) throw result.error;
   if (!result.value)
      throw WebAppError.internal(
         "Falha ao criar cliente: insert retornou vazio.",
      );
   return mapCustomer(result.value);
});

export const get = impl.get.handler(async ({ context, input }) => {
   const result = await fromPromise(
      context.db.query.contacts.findFirst({
         where: (f, { and, eq }) =>
            and(
               eq(f.externalId, input.externalId),
               eq(f.teamId, context.teamId),
               eq(f.type, "cliente"),
            ),
      }),
      () => WebAppError.internal("Falha ao buscar cliente."),
   );
   if (result.isErr()) throw result.error;
   if (!result.value || result.value.isArchived)
      throw WebAppError.notFound("Cliente não encontrado.");
   return mapCustomer(result.value);
});

export const list = impl.list.handler(async ({ context, input }) => {
   const where = and(
      eq(contacts.teamId, context.teamId),
      eq(contacts.type, "cliente"),
      eq(contacts.isArchived, false),
   );

   const result = await fromPromise(
      (async () => {
         const [totalRow] = await context.db
            .select({ value: count() })
            .from(contacts)
            .where(where);
         const total = totalRow?.value ?? 0;
         const items = await context.db
            .select()
            .from(contacts)
            .where(where)
            .orderBy(asc(contacts.name))
            .limit(input.limit)
            .offset((input.page - 1) * input.limit);
         return { items, total };
      })(),
      () => WebAppError.internal("Falha ao listar clientes."),
   );
   if (result.isErr()) throw result.error;

   const { items, total } = result.value;
   return {
      items: items.map(mapCustomer),
      total,
      page: input.page,
      limit: input.limit,
      pages: Math.ceil(total / input.limit),
   };
});

export const update = impl.update.handler(async ({ context, input }) => {
   const { externalId, ...data } = input;
   const existing = await fromPromise(
      context.db.query.contacts.findFirst({
         where: (f, { and, eq }) =>
            and(
               eq(f.externalId, externalId),
               eq(f.teamId, context.teamId),
               eq(f.type, "cliente"),
            ),
      }),
      () => WebAppError.internal("Falha ao buscar cliente."),
   );
   if (existing.isErr()) throw existing.error;
   const existingContact = existing.value;
   if (!existingContact) throw WebAppError.notFound("Cliente não encontrado.");

   const updated = await fromPromise(
      context.db.transaction(async (tx) => {
         const [row] = await tx
            .update(contacts)
            .set({ ...data, updatedAt: dayjs().toDate() })
            .where(eq(contacts.id, existingContact.id))
            .returning();
         return row;
      }),
      () => WebAppError.internal("Falha ao atualizar cliente."),
   );
   if (updated.isErr()) throw updated.error;
   if (!updated.value)
      throw WebAppError.internal(
         "Falha ao atualizar cliente: update retornou vazio.",
      );
   return mapCustomer(updated.value);
});
