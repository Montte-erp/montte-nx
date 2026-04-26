import { fromPromise, okAsync, type ResultAsync } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import type { HyprPayClient } from "@montte/hyprpay";

export type IngestUsageEventInput = {
   hyprpayClient: HyprPayClient;
   db: DatabaseInstance;
   externalId: string;
   eventName: string;
   quantity?: number;
   idempotencyKey?: string;
   properties?: Record<string, unknown>;
};

export type IngestUsageEventResult =
   | { ingested: true; meterId: string; idempotencyKey: string }
   | { ingested: false; reason: "no-meter-configured" };

export class IngestUsageEventError extends Error {
   constructor(message: string, options?: { cause?: unknown }) {
      super(message, options);
      this.name = "IngestUsageEventError";
   }
}

export function ingestUsageEvent(
   input: IngestUsageEventInput,
): ResultAsync<IngestUsageEventResult, IngestUsageEventError> {
   return fromPromise(
      input.db.query.meters.findFirst({
         where: (f, { and, eq }) =>
            and(eq(f.eventName, input.eventName), eq(f.isActive, true)),
         columns: { id: true },
      }),
      (cause) =>
         new IngestUsageEventError("Falha ao buscar meter de uso.", { cause }),
   ).andThen((meter) => {
      if (!meter) {
         return okAsync<IngestUsageEventResult, IngestUsageEventError>({
            ingested: false,
            reason: "no-meter-configured",
         });
      }
      return input.hyprpayClient.usage
         .ingest({
            externalId: input.externalId,
            meterId: meter.id,
            quantity: input.quantity ?? 1,
            idempotencyKey: input.idempotencyKey,
            properties: input.properties,
         })
         .map((response) => ({
            ingested: true as const,
            meterId: meter.id,
            idempotencyKey: response.idempotencyKey,
         }))
         .mapErr(
            (cause) =>
               new IngestUsageEventError("Falha ao ingerir uso no HyprPay.", {
                  cause,
               }),
         );
   });
}
