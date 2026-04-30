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

export const promptsClientStub = {
   get: vi.fn().mockResolvedValue({
      source: "active",
      prompt: "Sistema: classifique as transações em lote.",
      name: "montte-classify-transaction",
      version: 1,
   }),
   compile: vi.fn((prompt: string) => prompt),
};

vi.mock("../../src/sse", async () => {
   return {
      classificationSseEvents: {
         publish: ssePublishSpy,
         eventTypes: [
            "classification.transaction_classified",
            "classification.keywords_derived",
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
      getClassificationPrompts: () => promptsClientStub,
   };
});
