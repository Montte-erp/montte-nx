import { DBOS } from "@dbos-inc/dbos-sdk";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { chat } from "@tanstack/ai";
import { desc, eq } from "drizzle-orm";
import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { flashModel } from "@core/ai/models";
import { WorkflowError } from "@core/dbos/errors";
import { messages } from "@core/database/schemas/messages";
import { threads } from "@core/database/schemas/threads";
import { AGENT_QUEUES } from "../constants";
import { agentsSseEvents } from "../sse";
import {
   agentsDataSource,
   createEnqueuer,
   getAgentsRedis,
   registerWorkflowOnce,
} from "./context";

export type RefreshSuggestionsInput = {
   threadId: string;
   teamId: string;
   organizationId: string;
};

const suggestionsSchema = z.array(z.string().min(2).max(140)).max(3);

async function refreshSuggestionsFn(input: RefreshSuggestionsInput) {
   const ctx = `[refresh-suggestions] thread=${input.threadId}`;
   DBOS.logger.info(`${ctx} running`);

   const recentResult = await fromPromise(
      agentsDataSource.runTransaction(
         async () => {
            const tx = agentsDataSource.client;
            return tx
               .select({ role: messages.role, parts: messages.parts })
               .from(messages)
               .where(eq(messages.threadId, input.threadId))
               .orderBy(desc(messages.createdAt))
               .limit(5);
         },
         { name: "loadRecentMessages" },
      ),
      (e) =>
         WorkflowError.database("Falha ao carregar mensagens.", { cause: e }),
   );
   if (recentResult.isErr()) throw recentResult.error;
   const recent = recentResult.value.slice().reverse();
   if (recent.length === 0) {
      DBOS.logger.info(`${ctx} skipping — no messages`);
      return;
   }

   const result = await fromPromise(
      DBOS.runStep(
         () =>
            chat({
               adapter: flashModel,
               outputSchema: suggestionsSchema,
               messages: [
                  {
                     role: "user",
                     content: [
                        {
                           type: "text",
                           content: `Baseado nestas mensagens, sugira até 3 perguntas curtas em pt-BR que o usuário poderia fazer em seguida. Retorne JSON puro: array de strings.

Conversa recente:
${JSON.stringify(recent)}`,
                        },
                     ],
                  },
               ],
               stream: false,
            }),
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
      (i) => `agents:suggestions:${i.threadId}`,
   );

export type EnqueueRefreshSuggestions = (
   client: DBOSClient,
   input: RefreshSuggestionsInput,
) => Promise<unknown>;
