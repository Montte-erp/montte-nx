import type { RequestContext } from "@packages/agents";
import {
   createRequestContext,
   handleChatStream,
   handleWorkflowStream,
   mastra,
} from "@packages/agents";
import { emitAiChatMessage } from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { getLogger } from "@core/logging/root";
import { createFileRoute } from "@tanstack/react-router";
import type { ModelMessage } from "ai";
import { createUIMessageStreamResponse } from "ai";
import { auth, db } from "@/integrations/orpc/server-instances";

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
            const {
               messages,
               threadId,
               mode = "platform",
               contextId,
               workflow,
               model,
               thinkingBudget,
            } = body;
            const resourceId = `${teamId}:${userId}`;

            function filterDataStreamParts() {
               return new TransformStream({
                  transform(chunk, controller) {
                     const type = (chunk as { type?: string }).type;
                     // Block all data-* parts — @assistant-ui/react v0.12.x does not
                     // register the `dataRenderers` scope, so any data part crashes
                     // the client regardless of its specific type.
                     // Log them so we can eventually build proper UI renderers.
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
               const memory = await mastra.getAgent("tecoAgent").getMemory();
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

            // ── Workflow path ──────────────────────────────────────────────────────────
            if (workflow === "content-creation" && contextId) {
               const lastUserMessage = [...messages]
                  .reverse()
                  .find((m: ModelMessage) => m.role === "user");
               const topic =
                  typeof lastUserMessage?.content === "string"
                     ? lastUserMessage.content
                     : "Untitled article";

               const workflowStream = await handleWorkflowStream({
                  mastra,
                  workflowId: "content-creation",
                  params: {
                     inputData: { topic },
                     requestContext: createRequestContext({
                        userId,
                        teamId: teamId ?? undefined,
                        organizationId,
                        db,
                        mode,
                     }) as RequestContext,
                  },
               });

               const filteredWorkflowStream = workflowStream.pipeThrough(
                  filterDataStreamParts(),
               );

               // Fire-and-forget: emit ai.chat_message event and track credit usage
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

               return createUIMessageStreamResponse({
                  stream: filteredWorkflowStream,
               });
            }
            // ── End workflow path ───────────────────────────────────────────────────────

            const stream = await handleChatStream({
               mastra,
               agentId: "tecoAgent",
               params: {
                  messages,
                  memory: { resource: resourceId, thread: threadId },
                  requestContext: createRequestContext({
                     userId,
                     teamId: teamId ?? undefined,
                     organizationId,
                     db,
                     mode,
                     ...(model ? { model } : {}),
                     ...(thinkingBudget ? { thinkingBudget } : {}),
                  }),
               },
            });

            // Filter out Mastra-internal data-* stream parts (e.g. data-tripwire,
            // data-tool-call-approval). @assistant-ui/react v0.12.x initialises the
            // `tools` scope in RuntimeAdapter but NOT `dataRenderers`, so any data
            // message part causes a "scope does not have dataRenderers" crash.
            const filteredStream = stream.pipeThrough(filterDataStreamParts());

            // Fire-and-forget: emit ai.chat_message event and track credit usage
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
