import {
   errAsync,
   fromPromise,
   ok,
   Result,
   type ResultAsync,
} from "neverthrow";
import { z } from "zod";
import type { Redis } from "@core/redis/connection";

export const SSE_SCOPE_KINDS = ["user", "team", "org"] as const;
export type SseScopeKind = (typeof SSE_SCOPE_KINDS)[number];

export const sseScopeSchema = z.discriminatedUnion("kind", [
   z.object({ kind: z.literal("user"), id: z.string() }),
   z.object({ kind: z.literal("team"), id: z.string() }),
   z.object({ kind: z.literal("org"), id: z.string() }),
]);

export type SseScope = z.infer<typeof sseScopeSchema>;

export const sseEnvelopeSchema = z.object({
   id: z.string(),
   type: z.string(),
   scope: sseScopeSchema,
   payload: z.unknown(),
   timestamp: z.string(),
});

export type SseEnvelope = z.infer<typeof sseEnvelopeSchema>;

export class SsePublishError extends Error {
   constructor(message: string, options?: { cause?: unknown }) {
      super(message, options);
      this.name = "SsePublishError";
   }
}

export function channelFor(scope: SseScope): string {
   return `sse:${scope.kind}:${scope.id}`;
}

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
   const eventTypes = Object.keys(definitions) as (keyof TDefs & string)[];

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

const safeJsonParse = Result.fromThrowable(
   (input: string) => JSON.parse(input) as unknown,
   () => null,
);

export function subscribeSse(
   redis: Redis,
   scopes: SseScope[],
   signal?: AbortSignal,
): AsyncIterable<SseEnvelope> {
   return {
      [Symbol.asyncIterator](): AsyncIterator<SseEnvelope, undefined> {
         const subscriber = redis.duplicate();
         const channels = scopes.map(channelFor);
         const channelSet = new Set(channels);
         const queue: SseEnvelope[] = [];
         const waiters: Array<
            (v: IteratorResult<SseEnvelope, undefined>) => void
         > = [];
         let started = false;
         let closed = false;

         const handler = (channel: string, message: string) => {
            if (!channelSet.has(channel)) return;
            const parsed = safeJsonParse(message);
            if (parsed.isErr()) return;
            const validated = sseEnvelopeSchema.safeParse(parsed.value);
            if (!validated.success) return;
            const waiter = waiters.shift();
            if (waiter) {
               waiter({ value: validated.data, done: false });
               return;
            }
            queue.push(validated.data);
         };

         const close = async () => {
            if (closed) return;
            closed = true;
            subscriber.off("message", handler);
            await subscriber.unsubscribe(...channels).catch(() => undefined);
            subscriber.disconnect();
            for (const w of waiters) w({ value: undefined, done: true });
            waiters.length = 0;
         };

         signal?.addEventListener("abort", () => void close(), { once: true });

         const start = async () => {
            if (started) return;
            started = true;
            subscriber.on("message", handler);
            await subscriber.subscribe(...channels);
         };

         return {
            async next() {
               await start();
               if (closed) return { value: undefined, done: true };
               const queued = queue.shift();
               if (queued) return { value: queued, done: false };
               return new Promise<IteratorResult<SseEnvelope, undefined>>(
                  (resolve) => {
                     waiters.push(resolve);
                  },
               );
            },
            async return() {
               await close();
               return { value: undefined, done: true };
            },
         };
      },
   };
}
