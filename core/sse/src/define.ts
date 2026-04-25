import { errAsync, fromPromise, ok, type ResultAsync } from "neverthrow";
import { z } from "zod";
import type { Redis } from "@core/redis/connection";
import { channelFor } from "./channels";
import { SsePublishError } from "./publisher";
import type { SseEnvelope, SseScope } from "./types";

export type SseEventDefinitions = Record<string, z.ZodTypeAny>;

export type SseEventOf<TDefs extends SseEventDefinitions> = {
   [K in keyof TDefs & string]: {
      type: K;
      payload: z.infer<TDefs[K]>;
   };
}[keyof TDefs & string];

export type SseModuleEvents<TDefs extends SseEventDefinitions> = {
   publish: (
      redis: Redis,
      scope: SseScope,
      event: SseEventOf<TDefs>,
   ) => ResultAsync<SseEnvelope, SsePublishError>;
   eventTypes: ReadonlyArray<keyof TDefs & string>;
};

export function defineSseEvents<TDefs extends SseEventDefinitions>(
   definitions: TDefs,
): SseModuleEvents<TDefs> {
   const eventTypes = Object.keys(definitions);

   const publish = (
      redis: Redis,
      scope: SseScope,
      event: SseEventOf<TDefs>,
   ): ResultAsync<SseEnvelope, SsePublishError> => {
      const schema = definitions[event.type];
      if (!schema) {
         return errAsync(
            new SsePublishError(`Unknown SSE event type: ${event.type}`),
         );
      }
      const validated = schema.safeParse(event.payload);
      if (!validated.success) {
         return errAsync(
            new SsePublishError(
               `Invalid payload for SSE event ${event.type}: ${validated.error.message}`,
               { cause: validated.error },
            ),
         );
      }
      const envelope: SseEnvelope = {
         id: crypto.randomUUID(),
         type: event.type,
         scope,
         payload: validated.data,
         timestamp: new Date().toISOString(),
      };
      return fromPromise(
         redis.publish(channelFor(scope), JSON.stringify(envelope)),
         (cause) =>
            new SsePublishError("Failed to publish SSE event.", { cause }),
      ).andThen(() => ok(envelope));
   };

   return { publish, eventTypes };
}
