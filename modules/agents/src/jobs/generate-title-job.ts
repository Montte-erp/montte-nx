import { chat } from "@tanstack/ai";
import { asc, eq } from "drizzle-orm";
import type { DrizzleTransactionLike, Job, SendOptions } from "pg-boss";
import { z } from "zod";
import { flashModel } from "@core/ai/models";
import { createAiObservabilityMiddleware } from "@core/ai/middleware";
import type { DatabaseInstance } from "@core/database/client";
import { messages } from "@core/database/schemas/messages";
import { threads } from "@core/database/schemas/threads";
import { getLogger } from "@core/logging/root";
import type { PgBossClient } from "@core/pg-boss/client";
import { PgBossJobError } from "@core/pg-boss/client";
import { fromDrizzleTransaction } from "@core/pg-boss/drizzle";
import type { Prompts } from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";
import { AGENT_PROMPTS, AGENT_QUEUES } from "../constants";
import { agentsSseEvents } from "../sse";
import {
   conversationTranscript,
   hasUserAndAssistantText,
} from "../workflows/conversation-transcript";

const logger = getLogger().child({ module: "agents.generate-title-job" });

export const generateThreadTitleJobInputSchema = z.object({
   threadId: z.string().uuid(),
   teamId: z.string().uuid(),
   organizationId: z.string().uuid(),
});

export type GenerateThreadTitleJobInput = z.infer<
   typeof generateThreadTitleJobInputSchema
>;

const MIN_TITLE_TRANSCRIPT_LENGTH = 24;

export const generateThreadTitleQueue = {
   name: AGENT_QUEUES.generateTitle,
   retryLimit: 2,
   retryDelay: 1,
   retryBackoff: true,
   expireInSeconds: 120,
   retentionSeconds: 86_400,
   deleteAfterSeconds: 86_400,
};

export async function enqueueGenerateThreadTitleJob(options: {
   boss: PgBossClient;
   input: GenerateThreadTitleJobInput;
   tx?: DrizzleTransactionLike;
}) {
   await options.boss.createQueue(
      generateThreadTitleQueue.name,
      generateThreadTitleQueue,
   );

   const sendOptions: SendOptions = {
      singletonKey: options.input.threadId,
      retryLimit: generateThreadTitleQueue.retryLimit,
      retryDelay: generateThreadTitleQueue.retryDelay,
      retryBackoff: generateThreadTitleQueue.retryBackoff,
      expireInSeconds: generateThreadTitleQueue.expireInSeconds,
      retentionSeconds: generateThreadTitleQueue.retentionSeconds,
      deleteAfterSeconds: generateThreadTitleQueue.deleteAfterSeconds,
   };
   if (options.tx) sendOptions.db = fromDrizzleTransaction(options.tx);

   const jobId = await options.boss.send(
      AGENT_QUEUES.generateTitle,
      options.input,
      sendOptions,
   );
   if (!jobId) {
      throw new PgBossJobError("Falha ao enfileirar geração de título.");
   }
   return jobId;
}

export async function handleGenerateThreadTitleJob(options: {
   db: DatabaseInstance;
   prompts: Prompts;
   redis: Redis;
   job: Job<GenerateThreadTitleJobInput>;
}) {
   const input = generateThreadTitleJobInputSchema.parse(options.job.data);
   const ctx = `[pg-boss generate-title] thread=${input.threadId}`;
   logger.info({ jobId: options.job.id, threadId: input.threadId }, "running");

   const recent = await options.db.transaction(async (tx) => {
      const thread = await tx.query.threads.findFirst({
         where: (f, { eq: eqFn }) => eqFn(f.id, input.threadId),
      });
      if (!thread || thread.title) return null;
      return tx
         .select({ role: messages.role, parts: messages.parts })
         .from(messages)
         .where(eq(messages.threadId, input.threadId))
         .orderBy(asc(messages.createdAt))
         .limit(6);
   });

   if (!recent || recent.length === 0) {
      logger.info(`${ctx} skipping: no messages or title already set`);
      return;
   }

   const transcript = conversationTranscript(recent);
   if (
      transcript.length < MIN_TITLE_TRANSCRIPT_LENGTH ||
      !hasUserAndAssistantText(recent)
   ) {
      logger.info(`${ctx} skipping: conversation too shallow`);
      return;
   }

   const { prompt, name, version } = await options.prompts.get(
      AGENT_PROMPTS.generateTitle,
      { withMetadata: true },
   );
   const titleResult = await chat({
      adapter: flashModel,
      messages: [
         {
            role: "user",
            content: [
               {
                  type: "text",
                  content: options.prompts.compile(prompt, { transcript }),
               },
            ],
         },
      ],
      stream: false,
      conversationId: input.threadId,
      middleware: [
         createAiObservabilityMiddleware({
            distinctId: input.teamId,
            organizationId: input.organizationId,
            teamId: input.teamId,
            conversationId: input.threadId,
            promptName: name,
            promptVersion: version,
            customProperties: {
               agent_role: "job",
               agent_workflow: "generate-title",
               agent_thread_id: input.threadId,
            },
         }),
      ],
   });

   const title = titleResult.trim().slice(0, 80);
   if (title.length === 0) {
      logger.warn(`${ctx} empty title generated: skipping`);
      return;
   }

   await options.db.transaction(async (tx) => {
      await tx
         .update(threads)
         .set({ title })
         .where(eq(threads.id, input.threadId));
   });

   const publish = await agentsSseEvents.publish(
      options.redis,
      { kind: "team", id: input.teamId },
      {
         type: "agent.thread.title_updated",
         payload: { threadId: input.threadId, title },
      },
   );
   if (publish.isErr()) {
      throw new PgBossJobError("Falha ao publicar atualização de título.", {
         cause: publish.error,
      });
   }

   logger.info({ threadId: input.threadId, title }, "completed");
}
