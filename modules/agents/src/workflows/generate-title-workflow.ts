import { DBOS } from "@dbos-inc/dbos-sdk";
import { chat } from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { asc, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { flashModel } from "@core/ai/models";
import { aiTraceAttributes } from "@core/ai/otel";
import type { WorkflowClient } from "@core/dbos/client";
import { WorkflowError } from "@core/dbos/errors";
import { messages } from "@core/database/schemas/messages";
import { threads } from "@core/database/schemas/threads";
import { getAiTracer } from "@core/logging";
import { AGENT_PROMPTS, AGENT_QUEUES } from "../constants";
import {
   conversationTranscript,
   hasUserAndAssistantText,
} from "./conversation-transcript";
import {
   agentsDataSource,
   createEnqueuer,
   getAgentsPrompts,
   registerWorkflowOnce,
} from "./context";

export type GenerateTitleInput = {
   threadId: string;
   teamId: string;
   organizationId: string;
};

const MIN_TITLE_TRANSCRIPT_LENGTH = 24;

async function generateThreadTitleFn(input: GenerateTitleInput) {
   const ctx = `[generate-title] thread=${input.threadId}`;
   DBOS.logger.info(`${ctx} running`);

   const recentResult = await fromPromise(
      agentsDataSource.runTransaction(
         async () => {
            const tx = agentsDataSource.client;
            const thread = await tx.query.threads.findFirst({
               where: (f, { eq: eqFn }) => eqFn(f.id, input.threadId),
            });
            if (!thread || thread.title) return null;
            const recent = await tx
               .select({ role: messages.role, parts: messages.parts })
               .from(messages)
               .where(eq(messages.threadId, input.threadId))
               .orderBy(asc(messages.createdAt))
               .limit(6);
            return recent;
         },
         { name: "loadRecentMessages" },
      ),
      (e) =>
         WorkflowError.database("Falha ao carregar mensagens.", { cause: e }),
   );
   if (recentResult.isErr()) throw recentResult.error;
   const recent = recentResult.value;
   if (!recent || recent.length === 0) {
      DBOS.logger.info(`${ctx} skipping — no messages or title already set`);
      return;
   }
   const transcript = conversationTranscript(recent);
   if (
      transcript.length < MIN_TITLE_TRANSCRIPT_LENGTH ||
      !hasUserAndAssistantText(recent)
   ) {
      DBOS.logger.info(`${ctx} skipping — conversation too shallow`);
      return;
   }

   const titleResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const prompts = getAgentsPrompts();
            const { prompt, name, version } = await prompts.get(
               AGENT_PROMPTS.generateTitle,
               { withMetadata: true },
            );
            return chat({
               adapter: flashModel,
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
                              agent_workflow: "generate-title",
                              agent_thread_id: input.threadId,
                           },
                        }),
                  }),
               ],
            });
         },
         { name: "generateTitle" },
      ),
      (e) => WorkflowError.internal("Falha ao gerar título.", { cause: e }),
   );
   if (titleResult.isErr()) throw titleResult.error;

   const title = titleResult.value.trim().slice(0, 80);
   if (title.length === 0) {
      DBOS.logger.warn(`${ctx} empty title generated — skipping`);
      return;
   }

   const updateResult = await fromPromise(
      agentsDataSource.runTransaction(
         async () => {
            const tx = agentsDataSource.client;
            await tx
               .update(threads)
               .set({ title })
               .where(eq(threads.id, input.threadId));
         },
         { name: "updateThreadTitle" },
      ),
      (e) => WorkflowError.database("Falha ao atualizar título.", { cause: e }),
   );
   if (updateResult.isErr()) throw updateResult.error;

   DBOS.logger.info(`${ctx} completed — title="${title}"`);
}

export const generateThreadTitleWorkflow = registerWorkflowOnce(
   generateThreadTitleFn,
);

export type EnqueueGenerateThreadTitle = (
   client: WorkflowClient,
   input: GenerateTitleInput,
) => Promise<unknown>;

export const enqueueGenerateThreadTitle: EnqueueGenerateThreadTitle =
   createEnqueuer<GenerateTitleInput>(
      generateThreadTitleFn.name,
      AGENT_QUEUES.generateTitle,
      (i) => `agents:title:${i.threadId}`,
   );
