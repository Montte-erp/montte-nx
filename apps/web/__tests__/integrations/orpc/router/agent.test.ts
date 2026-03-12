import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_ORG_ID,
   TEST_TEAM_ID,
   TEST_USER_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

vi.mock("@packages/agents", () => ({
   mastra: {
      getAgent: vi.fn(),
   },
   createRequestContext: vi.fn().mockReturnValue({}),
}));

vi.mock("@packages/agents/models", () => ({
   AVAILABLE_MODELS: {},
   DEFAULT_CONTENT_MODEL_ID: "test-content-model",
   getModelPreset: vi.fn().mockReturnValue({
      temperature: 0.7,
      topP: 1,
      maxTokens: 4096,
      frequencyPenalty: 0,
      presencePenalty: 0,
   }),
}));

vi.mock("@packages/events/ai");
import { mastra } from "@packages/agents";
import { emitAiChatMessage } from "@packages/events/ai";

import * as agentRouter from "@/integrations/orpc/router/agent";

function createMockFullStream(
   events: Array<{ type: string; textDelta?: string }>,
) {
   return {
      fullStream: (async function* () {
         for (const event of events) {
            yield event;
         }
      })(),
   };
}

function setupAgentMock(streamResult: unknown) {
   vi.mocked(mastra.getAgent).mockReturnValue({
      stream: vi.fn().mockResolvedValue(streamResult),
   } as unknown as ReturnType<typeof mastra.getAgent>);
}

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(emitAiChatMessage).mockResolvedValue(undefined);
});

async function collectChunks<T>(iterable: AsyncIterable<T>): Promise<T[]> {
   const chunks: T[] = [];
   for await (const chunk of iterable) {
      chunks.push(chunk);
   }
   return chunks;
}

describe("aiCommandStream", () => {
   it("yields text chunks from fullStream", async () => {
      setupAgentMock(
         createMockFullStream([
            { type: "text-delta", textDelta: "Hi" },
            { type: "text-delta", textDelta: " there" },
         ]),
      );

      const ctx = createTestContext();
      const iterable = await call(
         agentRouter.aiCommandStream,
         { prompt: "Hello" },
         { context: ctx },
      );
      const chunks = await collectChunks(iterable);

      const textChunks = chunks.filter(
         (c: Record<string, unknown>) => c.type === "text",
      );
      expect(textChunks).toHaveLength(2);
      expect(textChunks[0]).toMatchObject({ type: "text", text: "Hi" });
      expect(textChunks[1]).toMatchObject({ type: "text", text: " there" });

      const lastChunk = chunks.at(-1) as Record<string, unknown>;
      expect(lastChunk.type).toBe("done");
   });

   it("emits ai.chat_message event after streaming", async () => {
      setupAgentMock(
         createMockFullStream([{ type: "text-delta", textDelta: "Hi" }]),
      );

      const ctx = createTestContext();
      const iterable = await call(
         agentRouter.aiCommandStream,
         { prompt: "Hello" },
         { context: ctx },
      );
      await collectChunks(iterable);

      expect(emitAiChatMessage).toHaveBeenCalledWith(
         expect.any(Function),
         expect.objectContaining({
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
         }),
         expect.objectContaining({
            provider: "openrouter",
            role: "assistant",
         }),
      );
   });
});
