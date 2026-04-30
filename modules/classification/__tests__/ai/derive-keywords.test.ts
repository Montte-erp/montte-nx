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
import type { AiObservabilityContext } from "@core/ai/middleware";
import type { Prompts } from "@core/posthog/server";

import { deriveKeywords } from "../../src/ai/derive-keywords";

const promptsMock = {
   get: vi.fn().mockResolvedValue({
      source: "active",
      prompt: "Sistema: derive palavras-chave para a entidade.",
      name: "montte-derive-keywords",
      version: 1,
   }),
   compile: vi.fn((prompt: string) => prompt),
} as unknown as Prompts;

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

describe("deriveKeywords", () => {
   it("derives keywords for category entity", async () => {
      const keywords = [
         "fast food",
         "restaurant",
         "delivery",
         "take out",
         "cafe",
      ];
      mock.onMessage("Food", {
         content: JSON.stringify({ keywords }),
         systemFingerprint: "fp_test",
      });

      const result = await deriveKeywords(
         promptsMock,
         { entity: "category", name: "Food", description: null },
         makeObservability(),
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value).toEqual(keywords);
      }
   });

   it("derives keywords for tag entity with description", async () => {
      const keywords = [
         "campaign",
         "promotion",
         "advertising",
         "branding",
         "outreach",
         "social media",
      ];
      mock.onMessage("Marketing", {
         content: JSON.stringify({ keywords }),
         systemFingerprint: "fp_test",
      });

      const result = await deriveKeywords(
         promptsMock,
         {
            entity: "tag",
            name: "Marketing",
            description: "promo activities",
         },
         makeObservability(),
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
         expect(result.value).toEqual(keywords);
      }
   });
});
