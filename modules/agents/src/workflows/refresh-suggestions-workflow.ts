import { DBOS } from "@dbos-inc/dbos-sdk";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { chat } from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { desc, eq } from "drizzle-orm";
import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { flashModel } from "@core/ai/models";
import { aiTraceAttributes } from "@core/ai/otel";
import { WorkflowError } from "@core/dbos/errors";
import { messages } from "@core/database/schemas/messages";
import { threads } from "@core/database/schemas/threads";
import { getAiTracer } from "@core/logging";
import { AGENT_PROMPTS, AGENT_QUEUES } from "../constants";
import { agentsSseEvents } from "../sse";
import {
   conversationTranscript,
   hasUserAndAssistantText,
} from "./conversation-transcript";
import {
   agentsDataSource,
   createEnqueuer,
   getAgentsPrompts,
   getAgentsRedis,
   registerWorkflowOnce,
} from "./context";

export type RefreshSuggestionsInput = {
   threadId: string;
   teamId: string;
   organizationId: string;
   messageCount: number;
};

const suggestionsSchema = z.array(z.string().min(2).max(140)).max(3);
const MIN_SUGGESTION_MESSAGE_COUNT = 4;
const SUGGESTION_MESSAGE_INTERVAL = 4;
const MIN_SUGGESTION_TRANSCRIPT_LENGTH = 80;

async function refreshSuggestionsFn(input: RefreshSuggestionsInput) {
   const ctx = `[refresh-suggestions] thread=${input.threadId}`;
   DBOS.logger.info(`${ctx} running`);
   if (
      input.messageCount < MIN_SUGGESTION_MESSAGE_COUNT ||
      input.messageCount % SUGGESTION_MESSAGE_INTERVAL !== 0
   ) {
      DBOS.logger.info(`${ctx} skipping — message count gate`);
      return;
   }

   const recentResult = await fromPromise(
      agentsDataSource.runTransaction(
         async () => {
            const tx = agentsDataSource.client;
            const recent = await tx
               .select({ role: messages.role, parts: messages.parts })
               .from(messages)
               .where(eq(messages.threadId, input.threadId))
               .orderBy(desc(messages.createdAt))
               .limit(8);
            return recent.slice().reverse();
         },
         { name: "loadRecentMessages" },
      ),
      (e) =>
         WorkflowError.database("Falha ao carregar mensagens.", { cause: e }),
   );
   if (recentResult.isErr()) throw recentResult.error;
   const recent = recentResult.value;
   if (recent.length === 0) {
      DBOS.logger.info(`${ctx} skipping — no messages`);
      return;
   }
   const transcript = conversationTranscript(recent);
   if (
      transcript.length < MIN_SUGGESTION_TRANSCRIPT_LENGTH ||
      !hasUserAndAssistantText(recent)
   ) {
      DBOS.logger.info(`${ctx} skipping — conversation too shallow`);
      return;
   }

   const result = await fromPromise(
      DBOS.runStep(
         async () => {
            const prompts = getAgentsPrompts();
            const { prompt, name, version } = await prompts.get(
               AGENT_PROMPTS.refreshSuggestions,
               { withMetadata: true },
            );
            return chat({
               adapter: flashModel,
               outputSchema: suggestionsSchema,
               messages: [
                  {
                     role: "user",
                     content: [
                        {
                           type: "text",
                           content: prompts.compile(prompt, { transcript }),
                        },
                     ],
                  },
               ],
               stream: false,
               conversationId: input.threadId,
               middleware: [
                  otelMiddleware({
                     tracer: getAiTracer(),
                     captureContent: false,
                     attributeEnricher: () =>
                        aiTraceAttributes({
                           distinctId: input.teamId,
                           organizationId: input.organizationId,
                           teamId: input.teamId,
                           threadId: input.threadId,
                           promptName: name,
                           promptVersion: version,
                           customProperties: {
                              agent_role: "workflow",
                              agent_workflow: "refresh-suggestions",
                              agent_thread_id: input.threadId,
                           },
                        }),
                  }),
               ],
            });
         },
         { name: "generateSuggestions" },
      ),
      (e) => WorkflowError.internal("Falha ao gerar sugestões.", { cause: e }),
   );
   if (result.isErr()) throw result.error;
   const suggestions = result.value;

   const updateResult = await fromPromise(
      agentsDataSource.runTransaction(
         async () => {
            const tx = agentsDataSource.client;
            await tx
               .update(threads)
               .set({
                  suggestions,
                  suggestionsUpdatedAt: dayjs().toDate(),
               })
               .where(eq(threads.id, input.threadId));
         },
         { name: "updateThreadSuggestions" },
      ),
      (e) =>
         WorkflowError.database("Falha ao atualizar sugestões.", { cause: e }),
   );
   if (updateResult.isErr()) throw updateResult.error;

   const publishResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const publish = await agentsSseEvents.publish(
               getAgentsRedis(),
               { kind: "team", id: input.teamId },
               {
                  type: "agent.thread.suggestions_updated",
                  payload: { threadId: input.threadId, suggestions },
               },
            );
            if (publish.isErr()) throw publish.error;
         },
         { name: "publishSuggestionsUpdated" },
      ),
      (e) => WorkflowError.internal("Falha ao publicar SSE.", { cause: e }),
   );
   if (publishResult.isErr()) throw publishResult.error;

   DBOS.logger.info(`${ctx} completed — ${suggestions.length} suggestions`);
}

export const refreshSuggestionsWorkflow =
   registerWorkflowOnce(refreshSuggestionsFn);

export const enqueueRefreshSuggestions =
   createEnqueuer<RefreshSuggestionsInput>(
      refreshSuggestionsFn.name,
      AGENT_QUEUES.refreshSuggestions,
      (i) => `agents:suggestions:${i.threadId}:${i.messageCount}`,
   );

export type EnqueueRefreshSuggestions = (
   client: DBOSClient,
   input: RefreshSuggestionsInput,
) => Promise<unknown>;
