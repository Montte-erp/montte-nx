import { implementerInternal } from "@orpc/server";
import { fromPromise } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import { getContactByExternalId } from "@core/database/repositories/contacts-repository";
import { listUsageEventsByContact } from "@core/database/repositories/usage-events-repository";
import { enqueueUsageIngestionWorkflow } from "@packages/workflows/workflows/billing/usage-ingestion-workflow";
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
      context.db,
      input.customerId,
      teamId,
      "cliente",
   );
   if (contactResult.isErr())
      throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value)
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });

   const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();

   const enqueueResult = await fromPromise(
      enqueueUsageIngestionWorkflow(context.workflowClient, {
         teamId,
         meterId: input.meterId,
         quantity: String(input.quantity),
         idempotencyKey,
         contactId: contactResult.value.id,
         properties: input.properties ?? {},
      }),
      (e) =>
         new WebAppError("INTERNAL_SERVER_ERROR", {
            message: "Falha ao enfileirar evento de uso.",
            source: "hyprpay",
            cause: e,
         }),
   );
   if (enqueueResult.isErr()) throw enqueueResult.error;

   return { queued: true, idempotencyKey };
});

export const list = impl.list.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const contactResult = await getContactByExternalId(
      context.db,
      input.customerId,
      teamId,
      "cliente",
   );
   if (contactResult.isErr())
      throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value)
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });

   const eventsResult = await listUsageEventsByContact(
      context.db,
      teamId,
      contactResult.value.id,
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
