import { implementerInternal } from "@orpc/server";
import { fromPromise } from "neverthrow";
import { db } from "@/integrations/singletons";
import { WebAppError } from "@core/logging/errors";
import { usageEvents } from "@core/database/schemas/usage-events";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import { getContactByExternalId } from "@core/database/repositories/contacts-repository";
import { listUsageEventsByContact } from "@core/database/repositories/usage-events-repository";
import { requireTeamId } from "./utils";

const impl = implementerInternal(
   hyprpayContract.usage,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

export const ingest = impl.ingest.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const contactResult = await getContactByExternalId(
      db,
      input.externalId,
      teamId,
      "cliente",
   );
   if (contactResult.isErr())
      throw WebAppError.fromAppError(contactResult.error);
   const contact = contactResult.value;
   if (!contact)
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });

   const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();

   const result = await fromPromise(
      db.transaction(async (tx) => {
         await tx
            .insert(usageEvents)
            .values({
               teamId,
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
      (e) =>
         new WebAppError("INTERNAL_SERVER_ERROR", {
            message: "Falha ao registrar evento de uso.",
            source: "hyprpay",
            cause: e,
         }),
   );
   if (result.isErr()) throw result.error;

   return { queued: true, idempotencyKey };
});

export const list = impl.list.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const contactResult = await getContactByExternalId(
      db,
      input.externalId,
      teamId,
      "cliente",
   );
   if (contactResult.isErr())
      throw WebAppError.fromAppError(contactResult.error);
   const contact = contactResult.value;
   if (!contact)
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });

   const eventsResult = await listUsageEventsByContact(
      db,
      teamId,
      contact.id,
      input.meterId,
   );
   if (eventsResult.isErr()) throw WebAppError.fromAppError(eventsResult.error);

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
