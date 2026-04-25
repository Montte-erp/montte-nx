import { fromPromise, ok, type ResultAsync } from "neverthrow";
import type { Redis } from "@core/redis/connection";
import { channelFor } from "./channels";
import type { SseEnvelope, SseScope } from "./types";

export type SseEventInput = Omit<SseEnvelope, "scope" | "timestamp" | "id"> & {
   id?: string;
   timestamp?: string;
};

export class SsePublishError extends Error {
   constructor(message: string, options?: { cause?: unknown }) {
      super(message, options);
      this.name = "SsePublishError";
   }
}

export function publishSse(
   redis: Redis,
   scope: SseScope,
   event: SseEventInput,
): ResultAsync<SseEnvelope, SsePublishError> {
   const envelope: SseEnvelope = {
      id: event.id ?? crypto.randomUUID(),
      type: event.type,
      scope,
      payload: event.payload,
      timestamp: event.timestamp ?? new Date().toISOString(),
   };
   return fromPromise(
      redis.publish(channelFor(scope), JSON.stringify(envelope)),
      (cause) => new SsePublishError("Failed to publish SSE event.", { cause }),
   ).andThen(() => ok(envelope));
}
