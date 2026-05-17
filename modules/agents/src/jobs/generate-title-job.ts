import { chat } from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { Result, TaggedError } from "better-result";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
   fromDrizzle,
   type DrizzleTransactionLike,
   type Job,
   type SendOptions,
} from "pg-boss";
import { z } from "zod";
import { flashModel } from "@core/ai/models";
import { aiTraceAttributes } from "@core/ai/otel";
import type { DatabaseInstance } from "@core/database/client";
import { messages } from "@core/database/schemas/messages";
import { threads } from "@core/database/schemas/threads";
import { getAiTracer, log } from "@core/logging";
import type { PgBossClient } from "@core/pg-boss/client";
import type { Prompts } from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";
import { AGENT_PROMPTS, AGENT_QUEUES } from "../constants";
import { agentsSseEvents } from "../sse";
import {
   conversationTranscript,
   hasUserAndAssistantText,
} from "../workflows/conversation-transcript";

export const generateThreadTitleJobInputSchema = z.object({
   threadId: z.string().uuid(),
   teamId: z.string().uuid(),
   organizationId: z.string().uuid(),
});

export type GenerateThreadTitleJobInput = z.infer<
   typeof generateThreadTitleJobInputSchema
>;

export class GenerateThreadTitleJobError extends TaggedError(
   "GenerateThreadTitleJobError",
)<{
   operation:
      | "enqueue"
      | "ensure_queue"
      | "parse_input"
      | "load_recent_messages"
      | "load_prompt"
      | "generate_title"
      | "write_title"
      | "publish_title";
   message: string;
   threadId?: string;
   cause?: unknown;
}>() {}

const MIN_TITLE_TRANSCRIPT_LENGTH = 24;

export const generateThreadTitleDeadLetterQueue = {
   name: AGENT_QUEUES.generateTitleDeadLetter,
   retryLimit: 0,
   expireInSeconds: 60,
   retentionSeconds: 2_592_000,
   deleteAfterSeconds: 2_592_000,
   warningQueueSize: 1,
};

export const generateThreadTitleQueue = {
   name: AGENT_QUEUES.generateTitle,
   policy: "key_strict_fifo",
   retryLimit: 3,
   retryDelay: 5,
   retryBackoff: true,
   retryDelayMax: 300,
   expireInSeconds: 300,
   retentionSeconds: 2_592_000,
   deleteAfterSeconds: 604_800,
   heartbeatSeconds: 30,
   warningQueueSize: 25,
   deadLetter: AGENT_QUEUES.generateTitleDeadLetter,
};

export async function enqueueGenerateThreadTitleJob(options: {
   boss: PgBossClient;
   input: GenerateThreadTitleJobInput;
   tx?: DrizzleTransactionLike;
}) {
   const queue = await Result.tryPromise({
      try: () => ensureGenerateThreadTitleQueues(options.boss),
      catch: (cause) =>
         new GenerateThreadTitleJobError({
            operation: "ensure_queue",
            message: "Falha ao preparar fila de geração de título.",
            threadId: options.input.threadId,
            cause,
         }),
   });
   if (Result.isError(queue)) {
      return Result.err(queue.error);
   }

   const sendOptions: SendOptions = {
      singletonKey: options.input.threadId,
      retryLimit: generateThreadTitleQueue.retryLimit,
      retryDelay: generateThreadTitleQueue.retryDelay,
      retryBackoff: generateThreadTitleQueue.retryBackoff,
      retryDelayMax: generateThreadTitleQueue.retryDelayMax,
      expireInSeconds: generateThreadTitleQueue.expireInSeconds,
      retentionSeconds: generateThreadTitleQueue.retentionSeconds,
      deleteAfterSeconds: generateThreadTitleQueue.deleteAfterSeconds,
      heartbeatSeconds: generateThreadTitleQueue.heartbeatSeconds,
      deadLetter: generateThreadTitleQueue.deadLetter,
      group: { id: options.input.teamId },
   };
   if (options.tx) sendOptions.db = fromDrizzle(options.tx, sql);

   const jobId = await Result.tryPromise({
      try: () =>
         options.boss.send(
            AGENT_QUEUES.generateTitle,
            options.input,
            sendOptions,
         ),
      catch: (cause) =>
         new GenerateThreadTitleJobError({
            operation: "enqueue",
            message: "Falha ao enfileirar geração de título.",
            threadId: options.input.threadId,
            cause,
         }),
   });

   if (Result.isError(jobId)) {
      return Result.err(jobId.error);
   }
   if (!jobId.value) {
      return Result.err(
         new GenerateThreadTitleJobError({
            operation: "enqueue",
            message: "Pg-boss não retornou o ID do job de geração de título.",
            threadId: options.input.threadId,
         }),
      );
   }
   return Result.ok(jobId.value);
}

async function ensureGenerateThreadTitleQueues(boss: PgBossClient) {
   const { name: deadLetterQueueName, ...deadLetterQueueOptions } =
      generateThreadTitleDeadLetterQueue;
   await boss.createQueue(deadLetterQueueName, deadLetterQueueOptions);
   await boss.updateQueue(deadLetterQueueName, deadLetterQueueOptions);
   const {
      name: generateTitleQueueName,
      policy,
      ...generateTitleQueueOptions
   } = generateThreadTitleQueue;
   await boss.createQueue(generateTitleQueueName, {
      ...generateTitleQueueOptions,
      policy,
   });
   await boss.updateQueue(generateTitleQueueName, generateTitleQueueOptions);
}

export async function handleGenerateThreadTitleJob(options: {
   db: DatabaseInstance;
   prompts: Prompts;
   redis: Redis;
   job: Job<GenerateThreadTitleJobInput>;
}) {
   const parsedInput = generateThreadTitleJobInputSchema.safeParse(
      options.job.data,
   );
   if (!parsedInput.success) {
      return Result.err(
         new GenerateThreadTitleJobError({
            operation: "parse_input",
            message: "Payload inválido para geração de título.",
            cause: parsedInput.error,
         }),
      );
   }

   const input = parsedInput.data;
   log.info({
      module: "agents.generate-title-job",
      message: "running",
      jobId: options.job.id,
      threadId: input.threadId,
      teamId: input.teamId,
      organizationId: input.organizationId,
   });

   const loaded = await Result.tryPromise({
      try: () =>
         options.db.transaction(async (tx) => {
            const thread = await tx.query.threads.findFirst({
               where: (f, { and: andFn, eq: eqFn }) =>
                  andFn(
                     eqFn(f.id, input.threadId),
                     eqFn(f.teamId, input.teamId),
                     eqFn(f.organizationId, input.organizationId),
                  ),
            });
            if (!thread) return null;
            if (thread.title) return { title: thread.title, recent: null };
            const recent = await tx
               .select({ role: messages.role, parts: messages.parts })
               .from(messages)
               .innerJoin(threads, eq(threads.id, messages.threadId))
               .where(
                  and(
                     eq(messages.threadId, input.threadId),
                     eq(threads.teamId, input.teamId),
                     eq(threads.organizationId, input.organizationId),
                  ),
               )
               .orderBy(asc(messages.createdAt))
               .limit(6);
            return { title: null, recent };
         }),
      catch: (cause) =>
         new GenerateThreadTitleJobError({
            operation: "load_recent_messages",
            message: "Falha ao carregar mensagens recentes para título.",
            threadId: input.threadId,
            cause,
         }),
   });

   if (Result.isError(loaded)) {
      return Result.err(loaded.error);
   }
   if (!loaded.value) {
      log.info({
         module: "agents.generate-title-job",
         message: "skipping: thread not found in scope",
         jobId: options.job.id,
         threadId: input.threadId,
      });
      return Result.ok(undefined);
   }
   if (loaded.value.title) {
      const publish = await publishTitleUpdated({
         redis: options.redis,
         input,
         title: loaded.value.title,
      });
      if (Result.isError(publish)) return Result.err(publish.error);
      log.info({
         module: "agents.generate-title-job",
         message: "republished existing title",
         jobId: options.job.id,
         threadId: input.threadId,
      });
      return Result.ok(undefined);
   }
   if (!loaded.value.recent || loaded.value.recent.length === 0) {
      log.info({
         module: "agents.generate-title-job",
         message: "skipping: no messages",
         jobId: options.job.id,
         threadId: input.threadId,
      });
      return Result.ok(undefined);
   }

   const transcript = conversationTranscript(loaded.value.recent);
   if (
      transcript.length < MIN_TITLE_TRANSCRIPT_LENGTH ||
      !hasUserAndAssistantText(loaded.value.recent)
   ) {
      log.info({
         module: "agents.generate-title-job",
         message: "skipping: conversation too shallow",
         jobId: options.job.id,
         threadId: input.threadId,
      });
      return Result.ok(undefined);
   }

   const prompt = await Result.tryPromise({
      try: () =>
         options.prompts.get(AGENT_PROMPTS.generateTitle, {
            withMetadata: true,
         }),
      catch: (cause) =>
         new GenerateThreadTitleJobError({
            operation: "load_prompt",
            message: "Falha ao carregar prompt de geração de título.",
            threadId: input.threadId,
            cause,
         }),
   });

   if (Result.isError(prompt)) {
      return Result.err(prompt.error);
   }

   const titleResult = await Result.tryPromise({
      try: () =>
         chat({
            adapter: flashModel,
            messages: [
               {
                  role: "user",
                  content: [
                     {
                        type: "text",
                        content: options.prompts.compile(prompt.value.prompt, {
                           transcript,
                        }),
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
                        promptName: prompt.value.name,
                        promptVersion: prompt.value.version,
                        customProperties: {
                           agent_role: "job",
                           agent_workflow: "generate-title",
                           agent_thread_id: input.threadId,
                           pg_boss_job_id: options.job.id,
                        },
                     }),
               }),
            ],
         }),
      catch: (cause) =>
         new GenerateThreadTitleJobError({
            operation: "generate_title",
            message: "Falha ao gerar título da conversa.",
            threadId: input.threadId,
            cause,
         }),
   });

   if (Result.isError(titleResult)) {
      return Result.err(titleResult.error);
   }

   const title = titleResult.value.trim().slice(0, 80);
   if (title.length === 0) {
      log.warn({
         module: "agents.generate-title-job",
         message: "empty title generated: skipping",
         jobId: options.job.id,
         threadId: input.threadId,
      });
      return Result.ok(undefined);
   }

   const write = await Result.tryPromise({
      try: () =>
         options.db.transaction(async (tx) => {
            return tx
               .update(threads)
               .set({ title })
               .where(
                  and(
                     eq(threads.id, input.threadId),
                     eq(threads.teamId, input.teamId),
                     eq(threads.organizationId, input.organizationId),
                     isNull(threads.title),
                  ),
               )
               .returning({ title: threads.title });
         }),
      catch: (cause) =>
         new GenerateThreadTitleJobError({
            operation: "write_title",
            message: "Falha ao salvar título gerado.",
            threadId: input.threadId,
            cause,
         }),
   });

   if (Result.isError(write)) {
      return Result.err(write.error);
   }
   const writtenTitle = write.value[0]?.title;
   if (!writtenTitle) {
      log.info({
         module: "agents.generate-title-job",
         message: "skipping: title already set concurrently",
         jobId: options.job.id,
         threadId: input.threadId,
      });
      return Result.ok(undefined);
   }

   const publish = await publishTitleUpdated({
      redis: options.redis,
      input,
      title: writtenTitle,
   });
   if (Result.isError(publish)) return Result.err(publish.error);

   log.info({
      module: "agents.generate-title-job",
      message: "completed",
      jobId: options.job.id,
      threadId: input.threadId,
      title,
   });
   return Result.ok(undefined);
}

async function publishTitleUpdated(options: {
   redis: Redis;
   input: GenerateThreadTitleJobInput;
   title: string;
}) {
   const publish = await agentsSseEvents.publish(
      options.redis,
      { kind: "team", id: options.input.teamId },
      {
         type: "agent.thread.title_updated",
         payload: {
            threadId: options.input.threadId,
            title: options.title,
         },
      },
   );
   if (Result.isError(publish)) {
      return Result.err(
         new GenerateThreadTitleJobError({
            operation: "publish_title",
            message: "Falha ao publicar título gerado.",
            threadId: options.input.threadId,
            cause: publish.error,
         }),
      );
   }
   return Result.ok(undefined);
}
