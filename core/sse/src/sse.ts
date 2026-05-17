import dayjs from "dayjs";
import { Result, TaggedError, type Result as ResultType } from "better-result";
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

export const ssePayloadSchema = z.json();

export const sseEnvelopeSchema = z.object({
   id: z.string(),
   type: z.string(),
   scope: sseScopeSchema,
   payload: ssePayloadSchema,
   timestamp: z.string(),
});

export type SseEnvelope = z.infer<typeof sseEnvelopeSchema>;

export class SsePublishError extends TaggedError("SsePublishError")<{
   operation: "validate_event" | "publish_event";
   message: string;
   eventType: string;
   cause?: unknown;
}>() {}

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
   ) => Promise<ResultType<SseEnvelope, SsePublishError>>;
   eventTypes: ReadonlyArray<keyof TDefs & string>;
};

export function defineSseEvents<TDefs extends SseEventDefinitions>(
   definitions: TDefs,
): SseModuleEvents<TDefs> {
   const eventTypes = Object.keys(definitions) as (keyof TDefs & string)[];

   const publish = async (
      redis: Redis,
      scope: SseScope,
      event: SseEventOf<TDefs>,
   ): Promise<ResultType<SseEnvelope, SsePublishError>> => {
      const schema = definitions[event.type];
      if (!schema) {
         return Result.err(
            new SsePublishError({
               operation: "validate_event",
               eventType: event.type,
               message: `Tipo de evento SSE desconhecido: ${event.type}`,
            }),
         );
      }
      const validated = schema.safeParse(event.payload);
      if (!validated.success) {
         return Result.err(
            new SsePublishError({
               operation: "validate_event",
               eventType: event.type,
               message: `Payload inválido para o evento SSE ${event.type}: ${validated.error.message}`,
               cause: validated.error,
            }),
         );
      }
      const payload = ssePayloadSchema.safeParse(validated.data);
      if (!payload.success) {
         return Result.err(
            new SsePublishError({
               operation: "validate_event",
               eventType: event.type,
               message: `Payload JSON inválido para o evento SSE ${event.type}: ${payload.error.message}`,
               cause: payload.error,
            }),
         );
      }
      const envelope: SseEnvelope = {
         id: crypto.randomUUID(),
         type: event.type,
         scope,
         payload: payload.data,
         timestamp: dayjs().toISOString(),
      };
      const published = await Result.tryPromise({
         try: () => redis.publish(channelFor(scope), JSON.stringify(envelope)),
         catch: (cause) =>
            new SsePublishError({
               operation: "publish_event",
               eventType: event.type,
               message: "Falha ao publicar evento SSE.",
               cause,
            }),
      });
      if (Result.isError(published)) return Result.err(published.error);
      return Result.ok(envelope);
   };

   return { publish, eventTypes };
}

const safeJsonParse = (input: string) =>
   Result.try({
      try: () => JSON.parse(input),
      catch: () =>
         new SsePublishError({
            operation: "validate_event",
            eventType: "unknown",
            message: "Envelope JSON de SSE inválido.",
         }),
   });

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
         const state = {
            started: false,
            closed: false,
         };

         const handler = (channel: string, message: string) => {
            if (!channelSet.has(channel)) return;
            const parsed = safeJsonParse(message);
            if (Result.isError(parsed)) return;
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
            if (state.closed) return;
            state.closed = true;
            subscriber.off("message", handler);
            await subscriber.unsubscribe(...channels).catch(() => undefined);
            subscriber.disconnect();
            for (const w of waiters) w({ value: undefined, done: true });
            waiters.length = 0;
         };

         signal?.addEventListener("abort", () => void close(), { once: true });

         const start = async () => {
            if (state.started) return;
            state.started = true;
            subscriber.on("message", handler);
            await subscriber.subscribe(...channels);
         };

         return {
            async next() {
               await start();
               if (state.closed) return { value: undefined, done: true };
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
