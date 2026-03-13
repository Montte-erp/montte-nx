import { call } from "@orpc/server";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
}));

vi.mock("@core/redis/connection", () => ({
   getRedisConnection: vi.fn().mockReturnValue({
      get: vi.fn(),
      set: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
   }),
   redis: {
      get: vi.fn(),
      set: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
   },
}));

vi.mock("@packages/events/emit", () => ({
   createEmitFn: vi.fn().mockReturnValue(vi.fn()),
   emitEvent: vi.fn(),
}));

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

import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as agentRouter from "@/integrations/orpc/router/agent";

let ctx: ORPCContextWithAuth;

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

async function collectChunks<T>(iterable: AsyncIterable<T>): Promise<T[]> {
   const chunks: T[] = [];
   for await (const chunk of iterable) {
      chunks.push(chunk);
   }
   return chunks;
}

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(emitAiChatMessage).mockResolvedValue(undefined);
});

describe("aiCommandStream", () => {
   it("yields text chunks from fullStream", async () => {
      setupAgentMock(
         createMockFullStream([
            { type: "text-delta", textDelta: "Hi" },
            { type: "text-delta", textDelta: " there" },
         ]),
      );

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

      const iterable = await call(
         agentRouter.aiCommandStream,
         { prompt: "Hello" },
         { context: ctx },
      );
      await collectChunks(iterable);

      const orgId = ctx.session!.session.activeOrganizationId;
      const userId = ctx.session!.user.id;
      const teamId = ctx.session!.session.activeTeamId;

      expect(emitAiChatMessage).toHaveBeenCalledWith(
         expect.any(Function),
         expect.objectContaining({
            organizationId: orgId,
            userId,
            teamId,
         }),
         expect.objectContaining({
            provider: "openrouter",
            role: "assistant",
         }),
      );
   });
});
