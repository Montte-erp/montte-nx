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
         prompt: "Sistema: classifique a transação.",
         name: "montte-classify-transaction",
         version: 1,
      }),
      compile: vi.fn((prompt: string) => prompt),
   },
}));

import { classifyTransaction } from "../../src/ai/classify";

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

describe("classifyTransaction", () => {
   it("returns categoryId + tagId resolved from names", async () => {
      mock.onMessage("Burger", {
         content: JSON.stringify({
            categoryName: "Food",
            tagName: "Operations",
         }),
         systemFingerprint: "fp_test",
      });

      const result = await classifyTransaction(
         { name: "Burger", type: "expense" },
         [{ id: "cat-1", name: "Food", keywords: null }],
         [{ id: "tag-1", name: "Operations", keywords: null }],
         makeObservability(),
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value).toEqual({
            categoryId: "cat-1",
            tagId: "tag-1",
         });
      }
   });

   it("returns null tagId when AI returns null tagName", async () => {
      mock.onMessage(/.*/, {
         content: JSON.stringify({ categoryName: "Food", tagName: null }),
         systemFingerprint: "fp_test",
      });

      const result = await classifyTransaction(
         { name: "X", type: "expense" },
         [{ id: "cat-1", name: "Food", keywords: null }],
         [],
         makeObservability(),
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value.tagId).toBeNull();
         expect(result.value.categoryId).toBe("cat-1");
      }
   });

   it("returns AppError when no matching category", async () => {
      mock.onMessage(/.*/, {
         content: JSON.stringify({ categoryName: "Unknown", tagName: null }),
         systemFingerprint: "fp_test",
      });

      const result = await classifyTransaction(
         { name: "X", type: "expense" },
         [{ id: "cat-1", name: "Food", keywords: null }],
         [],
         makeObservability(),
      );

      expect(result.isErr()).toBe(true);
   });
});
