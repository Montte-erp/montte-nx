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
   async (_input: {
      meterId?: string;
      eventName?: string;
      quantity: string;
      idempotencyKey: string;
      externalId?: string | null;
      properties?: Record<string, unknown>;
   }) => ({ success: true as const }),
);

const hyprpayClientStub = {
   services: { ingestUsage: hyprpayUsageIngestSpy },
};

vi.mock("../../src/sse", async () => {
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
