import { chat, convertMessagesToModelMessages } from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { defineErrorCatalog } from "evlog";
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
import { AGENT_JOB_QUEUES, AGENT_PROMPTS } from "../constants";

export const generateThreadTitleJobInputSchema = z.object({
   threadId: z.string().uuid(),
   teamId: z.string().uuid(),
   organizationId: z.string().uuid(),
});

export type GenerateThreadTitleJobInput = z.infer<
   typeof generateThreadTitleJobInputSchema
>;

const generateTitleJobErrors = defineErrorCatalog("agents.job.title", {
   ENQUEUE_FAILED: {
      status: 500,
      message: "Falha ao enfileirar geração de título.",
      tags: ["agents", "pg-boss", "title"],
   },
   JOB_ID_MISSING: {
      status: 500,
      message: "Pg-boss não retornou o ID do job de geração de título.",
      tags: ["agents", "pg-boss", "title"],
   },
   INVALID_PAYLOAD: {
      status: 400,
      message: "Payload inválido para geração de título.",
      tags: ["agents", "pg-boss", "title"],
   },
   MESSAGES_LOAD_FAILED: {
      status: 500,
      message: "Falha ao carregar mensagens recentes para título.",
      tags: ["agents", "pg-boss", "title"],
   },
   PROMPT_LOAD_FAILED: {
      status: 500,
      message: "Falha ao carregar prompt de geração de título.",
      tags: ["agents", "pg-boss", "title"],
   },
   AI_FAILED: {
      status: 500,
      message: "Falha ao gerar título da conversa.",
      tags: ["agents", "pg-boss", "title"],
   },
   WRITE_FAILED: {
      status: 500,
      message: "Falha ao salvar título gerado.",
      tags: ["agents", "pg-boss", "title"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "agents.job.title": typeof generateTitleJobErrors;
   }
}

type GenerateThreadTitleJobCatalogError =
   | ReturnType<typeof generateTitleJobErrors.ENQUEUE_FAILED>
   | ReturnType<typeof generateTitleJobErrors.JOB_ID_MISSING>
   | ReturnType<typeof generateTitleJobErrors.INVALID_PAYLOAD>
   | ReturnType<typeof generateTitleJobErrors.MESSAGES_LOAD_FAILED>
   | ReturnType<typeof generateTitleJobErrors.PROMPT_LOAD_FAILED>
   | ReturnType<typeof generateTitleJobErrors.AI_FAILED>
   | ReturnType<typeof generateTitleJobErrors.WRITE_FAILED>;

export class GenerateThreadTitleJobError extends TaggedError(
   "GenerateThreadTitleJobError",
)<{
   error: GenerateThreadTitleJobCatalogError;
   threadId?: string;
}>() {}

const TITLE_DEBOUNCE_SECONDS = 30;

export const generateThreadTitleDeadLetterQueue = {
   name: AGENT_JOB_QUEUES.generateTitleDeadLetter,
   retryLimit: 0,
   expireInSeconds: 60,
   retentionSeconds: 2_592_000,
   deleteAfterSeconds: 2_592_000,
   warningQueueSize: 1,
};

export const generateThreadTitleQueue = {
   name: AGENT_JOB_QUEUES.generateTitle,
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
   deadLetter: AGENT_JOB_QUEUES.generateTitleDeadLetter,
};

export async function enqueueGenerateThreadTitleJob(options: {
   boss: PgBossClient;
   input: GenerateThreadTitleJobInput;
   tx?: DrizzleTransactionLike;
}) {
   const sendOptions: SendOptions = {
      singletonKey: options.input.threadId,
      singletonSeconds: TITLE_DEBOUNCE_SECONDS,
      singletonNextSlot: true,
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
            AGENT_JOB_QUEUES.generateTitle,
            options.input,
            sendOptions,
         ),
      catch: () =>
         new GenerateThreadTitleJobError({
            error: generateTitleJobErrors.ENQUEUE_FAILED({
               internal: { threadId: options.input.threadId },
            }),
            threadId: options.input.threadId,
         }),
   });

   if (Result.isError(jobId)) {
      return Result.err(jobId.error);
   }
   if (!jobId.value) {
      return Result.err(
         new GenerateThreadTitleJobError({
            error: generateTitleJobErrors.JOB_ID_MISSING({
               internal: { threadId: options.input.threadId },
            }),
            threadId: options.input.threadId,
         }),
      );
   }
   return Result.ok(jobId.value);
}

export async function handleGenerateThreadTitleJob(options: {
   db: DatabaseInstance;
   prompts: Prompts;
   job: Job<GenerateThreadTitleJobInput>;
}) {
   const parsedInput = generateThreadTitleJobInputSchema.safeParse(
      options.job.data,
   );
   if (!parsedInput.success) {
      return Result.err(
         new GenerateThreadTitleJobError({
            error: generateTitleJobErrors.INVALID_PAYLOAD({
               internal: { jobId: options.job.id },
            }),
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
               .select({
                  id: messages.id,
                  role: messages.role,
                  parts: messages.parts,
               })
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
      catch: () =>
         new GenerateThreadTitleJobError({
            error: generateTitleJobErrors.MESSAGES_LOAD_FAILED({
               internal: {
                  jobId: options.job.id,
                  threadId: input.threadId,
               },
            }),
            threadId: input.threadId,
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
      log.info({
         module: "agents.generate-title-job",
         message: "skipping: title already exists",
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

   const recent = loaded.value.recent;
   const hasUser = recent.some((row) => row.role === "user");
   const hasAssistant = recent.some((row) => row.role === "assistant");
   if (!hasUser || !hasAssistant) {
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
      catch: () =>
         new GenerateThreadTitleJobError({
            error: generateTitleJobErrors.PROMPT_LOAD_FAILED({
               internal: {
                  jobId: options.job.id,
                  threadId: input.threadId,
               },
            }),
            threadId: input.threadId,
         }),
   });

   if (Result.isError(prompt)) {
      return Result.err(prompt.error);
   }

   const titleResult = await Result.tryPromise({
      try: () =>
         chat({
            adapter: flashModel,
            messages: convertMessagesToModelMessages([
               ...recent,
               {
                  id: `${options.job.id}-title-request`,
                  role: "user",
                  parts: [
                     {
                        type: "text",
                        content: options.prompts.compile(prompt.value.prompt, {
                           transcript:
                              "A conversa recente está disponível nas mensagens anteriores.",
                        }),
                     },
                  ],
               },
            ]),
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
      catch: () =>
         new GenerateThreadTitleJobError({
            error: generateTitleJobErrors.AI_FAILED({
               internal: {
                  jobId: options.job.id,
                  threadId: input.threadId,
               },
            }),
            threadId: input.threadId,
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
      catch: () =>
         new GenerateThreadTitleJobError({
            error: generateTitleJobErrors.WRITE_FAILED({
               internal: {
                  jobId: options.job.id,
                  threadId: input.threadId,
               },
            }),
            threadId: input.threadId,
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

   log.info({
      module: "agents.generate-title-job",
      message: "completed",
      jobId: options.job.id,
      threadId: input.threadId,
      title,
   });
   return Result.ok(undefined);
}
