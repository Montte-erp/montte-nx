import { implementerInternal } from "@orpc/server";
import { fromPromise } from "neverthrow";
import { usageEvents } from "@core/database/schemas/usage-events";
import { WebAppError } from "@core/logging/errors";
import {
   type ORPCContext,
   type ORPCContextWithOrganization,
   protectedProcedure,
} from "@core/orpc/server";
import { hyprpayContract } from "@montte/hyprpay/contract";

const impl = implementerInternal<
   typeof hyprpayContract.usage,
   ORPCContext,
   ORPCContextWithOrganization
>(hyprpayContract.usage, protectedProcedure["~orpc"].config, [
   ...protectedProcedure["~orpc"].middlewares,
]);

export const ingest = impl.ingest.handler(async ({ context, input }) => {
   const contactResult = await fromPromise(
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
   if (contactResult.isErr()) throw contactResult.error;
   const contact = contactResult.value;
   if (!contact) throw WebAppError.notFound("Cliente não encontrado.");

   const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();

   const result = await fromPromise(
      context.db.transaction(async (tx) => {
         await tx
            .insert(usageEvents)
            .values({
               teamId: context.teamId,
               meterId: input.meterId,
               quantity: String(input.quantity),
               idempotencyKey,
               contactId: contact.id,
               properties: input.properties ?? {},
            })
            .onConflictDoNothing({
               target: [usageEvents.teamId, usageEvents.idempotencyKey],
            });
      }),
      () => WebAppError.internal("Falha ao registrar evento de uso."),
   );
   if (result.isErr()) throw result.error;

   return { queued: true, idempotencyKey };
});

export const list = impl.list.handler(async ({ context, input }) => {
   const contactResult = await fromPromise(
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
   if (contactResult.isErr()) throw contactResult.error;
   const contact = contactResult.value;
   if (!contact) throw WebAppError.notFound("Cliente não encontrado.");

   const eventsResult = await fromPromise(
      context.db.query.usageEvents.findMany({
         where: (f, { and, eq }) =>
            and(
               eq(f.teamId, context.teamId),
               eq(f.contactId, contact.id),
               ...(input.meterId ? [eq(f.meterId, input.meterId)] : []),
            ),
      }),
      () => WebAppError.internal("Falha ao listar eventos de uso."),
   );
   if (eventsResult.isErr()) throw eventsResult.error;

   return eventsResult.value.map((e) => ({
      teamId: e.teamId,
      meterId: e.meterId,
      quantity: Number(e.quantity),
      idempotencyKey: e.idempotencyKey,
      contactId: e.contactId ?? null,
      properties: e.properties,
      timestamp: e.timestamp.toISOString(),
   }));
});
