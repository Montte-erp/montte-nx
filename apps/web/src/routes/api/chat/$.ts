import { createRequestContext, handleChatStream, mastra } from "@core/agents";
import { emitAiChatMessage } from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { getLogger } from "@core/logging/root";
import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStreamResponse } from "ai";
import { auth, db } from "@/integrations/singletons";

const logger = getLogger().child({ module: "api:chat" });

export const Route = createFileRoute("/api/chat/$")({
   server: {
      handlers: {
         POST: async ({ request }) => {
            const session = await auth.api.getSession({
               headers: request.headers,
            });

            if (!session) return new Response("Unauthorized", { status: 401 });

            const teamId = session.session.activeTeamId;
            const userId = session.session.userId;
            const organizationId =
               session.session.activeOrganizationId ?? undefined;
            const body = await request.json();
            const { messages, threadId, model, thinkingBudget } = body;
            const resourceId = `${teamId}:${userId}`;

            function filterDataStreamParts() {
               return new TransformStream({
                  transform(chunk, controller) {
                     const type = (chunk as { type?: string }).type;
                     if (typeof type === "string" && type.startsWith("data-")) {
                        logger.debug(
                           { type, chunk },
                           "Filtered data-stream part",
                        );
                        return;
                     }
                     controller.enqueue(chunk);
                  },
               });
            }

            if (threadId) {
               const memory = await mastra.getAgent("rubiAgent").getMemory();
               if (!memory)
                  return new Response("Memory not configured", { status: 500 });
               const thread = await memory.getThreadById({
                  threadId: threadId,
               });
               if (thread?.resourceId !== resourceId) {
                  return new Response("Thread not found or access denied", {
                     status: 403,
                  });
               }
            }

            const stream = await handleChatStream({
               mastra,
               agentId: "rubiAgent",
               params: {
                  messages,
                  memory: { resource: resourceId, thread: threadId },
                  requestContext: createRequestContext({
                     userId,
                     teamId: teamId ?? undefined,
                     organizationId,
                     db,
                     ...(model ? { model } : {}),
                     ...(thinkingBudget ? { thinkingBudget } : {}),
                  }),
               },
            });

            const filteredStream = stream.pipeThrough(filterDataStreamParts());

            if (organizationId) {
               const chatId = threadId ?? crypto.randomUUID();
               void emitAiChatMessage(
                  createEmitFn(db),
                  { organizationId, userId, teamId: teamId ?? undefined },
                  {
                     chatId,
                     model:
                        typeof model === "string"
                           ? model
                           : "openrouter/default",
                     provider: "openrouter",
                     role: "assistant",
                     promptTokens: 0,
                     completionTokens: 0,
                     totalTokens: 0,
                     latencyMs: 0,
                  },
               );
            }

            return createUIMessageStreamResponse({ stream: filteredStream });
         },
      },
   },
});
