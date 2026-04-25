import { Result } from "neverthrow";
import type { Redis } from "@core/redis/connection";
import { channelFor } from "./channels";
import { sseEnvelopeSchema } from "./types";
import type { SseEnvelope, SseScope } from "./types";

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
