import { okAsync } from "neverthrow";
import { vi } from "vitest";

export const ssePublishSpy = vi.fn(
   (
      _redis: unknown,
      scope: { kind: string; id: string },
      event: { type: string; payload: unknown },
   ) =>
      okAsync({
         id: crypto.randomUUID(),
         type: event.type,
         scope,
         payload: event.payload,
         timestamp: new Date().toISOString(),
      }),
);

export const posthogCaptureSpy = vi.fn();

export const hyprpayUsageIngestSpy = vi.fn(
   (input: {
      customerId: string;
      meterId: string;
      quantity: number;
      idempotencyKey?: string;
      properties?: Record<string, unknown>;
   }) =>
      okAsync({
         queued: true,
         idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
      }),
);

const hyprpayClientStub = {
   usage: { ingest: hyprpayUsageIngestSpy },
};

vi.mock("../../src/sse/events", async () => {
   return {
      classificationSseEvents: {
         publish: ssePublishSpy,
         eventTypes: [
            "classification.transaction_classified",
            "classification.keywords_derived",
            "classification.keywords_backfilled",
         ],
      },
   };
});

vi.mock("../../src/workflows/context", async (importOriginal) => {
   const actual =
      await importOriginal<typeof import("../../src/workflows/context")>();
   return {
      ...actual,
      getClassificationRedis: () => ({}),
      getClassificationPosthog: () => ({ capture: posthogCaptureSpy }),
      getClassificationHyprpay: () => hyprpayClientStub,
   };
});
