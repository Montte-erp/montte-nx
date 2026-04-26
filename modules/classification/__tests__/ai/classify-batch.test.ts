import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { LLMock } from "@copilotkit/aimock";
import { PostHog } from "posthog-node";
import type { AiObservabilityContext } from "@core/ai/observability";

vi.mock("@core/posthog/server", () => ({
   promptsClient: {
      get: vi.fn().mockResolvedValue({
         source: "active",
         prompt: "Sistema: classifique as transações em lote.",
         name: "montte-classify-transaction",
         version: 1,
      }),
      compile: vi.fn((prompt: string) => prompt),
   },
}));

import { classifyTransactionsBatch } from "../../src/ai/classify-batch";

const mock = new LLMock({ port: 14010 });

function makeObservability(): AiObservabilityContext {
   const posthog = new PostHog("phc_test", {
      host: "https://us.i.posthog.com",
      flushAt: Number.POSITIVE_INFINITY,
      disableGeoip: true,
   });
   vi.spyOn(posthog, "capture").mockImplementation(() => undefined);
   return { posthog, distinctId: "team-1" };
}

beforeAll(async () => {
   await mock.start();
});

afterAll(async () => {
   await mock.stop();
});

beforeEach(() => {
   mock.clearFixtures();
});

describe("classifyTransactionsBatch", () => {
   it("classifies a batch of 3 transactions returning all 3 mapped IDs", async () => {
      mock.onMessage(/tx-1/, {
         content: JSON.stringify({
            results: [
               { id: "tx-1", categoryName: "Food" },
               { id: "tx-2", categoryName: "Fuel" },
               { id: "tx-3", categoryName: "Food" },
            ],
         }),
         systemFingerprint: "fp_test",
      });

      const result = await classifyTransactionsBatch(
         [
            { id: "tx-1", name: "Burger", type: "expense" },
            { id: "tx-2", name: "Posto Shell", type: "expense" },
            { id: "tx-3", name: "Uber Eats", type: "expense" },
         ],
         [
            { id: "cat-food", name: "Food", keywords: null },
            { id: "cat-fuel", name: "Fuel", keywords: null },
         ],
         makeObservability(),
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value).toEqual([
            { transactionId: "tx-1", categoryId: "cat-food" },
            { transactionId: "tx-2", categoryId: "cat-fuel" },
            { transactionId: "tx-3", categoryId: "cat-food" },
         ]);
      }
   });

   it("drops transactions that the LLM omits from results", async () => {
      mock.onMessage(/tx-1/, {
         content: JSON.stringify({
            results: [
               { id: "tx-1", categoryName: "Food" },
               { id: "tx-3", categoryName: "Food" },
            ],
         }),
         systemFingerprint: "fp_test",
      });

      const result = await classifyTransactionsBatch(
         [
            { id: "tx-1", name: "A", type: "expense" },
            { id: "tx-2", name: "B", type: "expense" },
            { id: "tx-3", name: "C", type: "expense" },
         ],
         [{ id: "cat-food", name: "Food", keywords: null }],
         makeObservability(),
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value).toHaveLength(2);
         expect(result.value.map((r) => r.transactionId)).toEqual([
            "tx-1",
            "tx-3",
         ]);
      }
   });

   it("drops transactions whose categoryName doesn't match any candidate", async () => {
      mock.onMessage(/tx-1/, {
         content: JSON.stringify({
            results: [
               { id: "tx-1", categoryName: "Food" },
               { id: "tx-2", categoryName: "Unknown" },
               { id: "tx-3", categoryName: "Food" },
            ],
         }),
         systemFingerprint: "fp_test",
      });

      const result = await classifyTransactionsBatch(
         [
            { id: "tx-1", name: "A", type: "expense" },
            { id: "tx-2", name: "B", type: "expense" },
            { id: "tx-3", name: "C", type: "expense" },
         ],
         [{ id: "cat-food", name: "Food", keywords: null }],
         makeObservability(),
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value).toHaveLength(2);
         expect(result.value.map((r) => r.transactionId)).toEqual([
            "tx-1",
            "tx-3",
         ]);
      }
   });

   it("returns AppError when batch exceeds 20 without calling LLM", async () => {
      const transactions = Array.from({ length: 21 }, (_, i) => ({
         id: `tx-${i + 1}`,
         name: `Transaction ${i + 1}`,
         type: "expense" as const,
      }));

      const result = await classifyTransactionsBatch(
         transactions,
         [{ id: "cat-food", name: "Food", keywords: null }],
         makeObservability(),
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
         expect(result.error.message).toContain("Batch maior que 20");
      }
   });

   it("drops null categoryName entries silently", async () => {
      mock.onMessage(/tx-1/, {
         content: JSON.stringify({
            results: [
               { id: "tx-1", categoryName: "Food" },
               { id: "tx-2", categoryName: null },
            ],
         }),
         systemFingerprint: "fp_test",
      });

      const result = await classifyTransactionsBatch(
         [
            { id: "tx-1", name: "A", type: "expense" },
            { id: "tx-2", name: "B", type: "expense" },
         ],
         [{ id: "cat-food", name: "Food", keywords: null }],
         makeObservability(),
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value).toEqual([
            { transactionId: "tx-1", categoryId: "cat-food" },
         ]);
      }
   });
});
