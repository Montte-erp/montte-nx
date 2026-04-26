import { fromPromise, okAsync, type ResultAsync } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { usageEvents } from "@core/database/schemas/usage-events";

export type IngestUsageEventInput = {
   db: DatabaseInstance;
   teamId: string;
   externalId: string;
   eventName: string;
   quantity?: number;
   idempotencyKey?: string;
   contactId?: string | null;
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

type CacheEntry = { meterId: string | null; expiresAt: number };
const METER_CACHE_TTL_MS = 5 * 60 * 1000;
const meterCache = new Map<string, CacheEntry>();

function meterCacheKey(teamId: string, eventName: string) {
   return `${teamId}:${eventName}`;
}

export function clearMeterCache() {
   meterCache.clear();
}

function getCachedMeterId(
   teamId: string,
   eventName: string,
): string | null | undefined {
   const entry = meterCache.get(meterCacheKey(teamId, eventName));
   if (!entry) return undefined;
   if (entry.expiresAt < Date.now()) {
      meterCache.delete(meterCacheKey(teamId, eventName));
      return undefined;
   }
   return entry.meterId;
}

function setCachedMeterId(
   teamId: string,
   eventName: string,
   meterId: string | null,
) {
   meterCache.set(meterCacheKey(teamId, eventName), {
      meterId,
      expiresAt: Date.now() + METER_CACHE_TTL_MS,
   });
}

export function ingestUsageEvent(
   input: IngestUsageEventInput,
): ResultAsync<IngestUsageEventResult, IngestUsageEventError> {
   const cached = getCachedMeterId(input.teamId, input.eventName);

   const meterIdAsync =
      cached !== undefined
         ? okAsync<string | null, IngestUsageEventError>(cached)
         : fromPromise(
              input.db.query.meters.findFirst({
                 where: (f, { and, eq }) =>
                    and(
                       eq(f.teamId, input.teamId),
                       eq(f.eventName, input.eventName),
                       eq(f.isActive, true),
                    ),
                 columns: { id: true },
              }),
              (cause) =>
                 new IngestUsageEventError("Falha ao buscar meter de uso.", {
                    cause,
                 }),
           ).map((meter) => {
              const id = meter?.id ?? null;
              setCachedMeterId(input.teamId, input.eventName, id);
              return id;
           });

   return meterIdAsync.andThen((meterId) => {
      if (!meterId) {
         return okAsync<IngestUsageEventResult, IngestUsageEventError>({
            ingested: false,
            reason: "no-meter-configured",
         });
      }

      const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
      const quantity = input.quantity ?? 1;

      return fromPromise(
         input.db.transaction(async (tx) => {
            await tx
               .insert(usageEvents)
               .values({
                  teamId: input.teamId,
                  meterId,
                  contactId: input.contactId ?? null,
                  quantity: String(quantity),
                  idempotencyKey,
                  properties: input.properties ?? {},
               })
               .onConflictDoNothing({
                  target: [usageEvents.teamId, usageEvents.idempotencyKey],
               });
         }),
         (cause) =>
            new IngestUsageEventError("Falha ao registrar evento de uso.", {
               cause,
            }),
      ).map(() => ({
         ingested: true as const,
         meterId,
         idempotencyKey,
      }));
   });
}
