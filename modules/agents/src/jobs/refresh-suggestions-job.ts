import { chat, convertMessagesToModelMessages } from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { defineErrorCatalog } from "evlog";
import { Result, TaggedError } from "better-result";
import dayjs from "dayjs";
import { and, desc, eq, sql } from "drizzle-orm";
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

export const refreshThreadSuggestionsJobInputSchema = z.object({
   threadId: z.string().uuid(),
   teamId: z.string().uuid(),
   organizationId: z.string().uuid(),
   messageCount: z.number().int().min(1),
});

export type RefreshThreadSuggestionsJobInput = z.infer<
   typeof refreshThreadSuggestionsJobInputSchema
>;

const refreshSuggestionsJobErrors = defineErrorCatalog(
   "agents.job.suggestions",
   {
      ENQUEUE_FAILED: {
         status: 500,
         message: "Falha ao enfileirar sugestões da conversa.",
         tags: ["agents", "pg-boss", "suggestions"],
      },
      JOB_ID_MISSING: {
         status: 500,
         message: "Pg-boss não retornou o ID do job de sugestões.",
         tags: ["agents", "pg-boss", "suggestions"],
      },
      INVALID_PAYLOAD: {
         status: 400,
         message: "Payload inválido para sugestões da conversa.",
         tags: ["agents", "pg-boss", "suggestions"],
      },
      MESSAGES_LOAD_FAILED: {
         status: 500,
         message: "Falha ao carregar mensagens recentes para sugestões.",
         tags: ["agents", "pg-boss", "suggestions"],
      },
      PROMPT_LOAD_FAILED: {
         status: 500,
         message: "Falha ao carregar prompt de sugestões.",
         tags: ["agents", "pg-boss", "suggestions"],
      },
      AI_FAILED: {
         status: 500,
         message: "Falha ao gerar sugestões da conversa.",
         tags: ["agents", "pg-boss", "suggestions"],
      },
      WRITE_FAILED: {
         status: 500,
         message: "Falha ao salvar sugestões da conversa.",
         tags: ["agents", "pg-boss", "suggestions"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "agents.job.suggestions": typeof refreshSuggestionsJobErrors;
   }
}

type RefreshThreadSuggestionsJobCatalogError =
   | ReturnType<typeof refreshSuggestionsJobErrors.ENQUEUE_FAILED>
   | ReturnType<typeof refreshSuggestionsJobErrors.JOB_ID_MISSING>
   | ReturnType<typeof refreshSuggestionsJobErrors.INVALID_PAYLOAD>
   | ReturnType<typeof refreshSuggestionsJobErrors.MESSAGES_LOAD_FAILED>
   | ReturnType<typeof refreshSuggestionsJobErrors.PROMPT_LOAD_FAILED>
   | ReturnType<typeof refreshSuggestionsJobErrors.AI_FAILED>
   | ReturnType<typeof refreshSuggestionsJobErrors.WRITE_FAILED>;

export class RefreshThreadSuggestionsJobError extends TaggedError(
   "RefreshThreadSuggestionsJobError",
)<{
   error: RefreshThreadSuggestionsJobCatalogError;
   message: string;
   threadId?: string;
   messageCount?: number;
}>() {}

const suggestionsSchema = z.array(z.string().min(2).max(140)).min(1).max(3);
const SUGGESTIONS_DEBOUNCE_SECONDS = 20;

export const refreshThreadSuggestionsDeadLetterQueue = {
   name: AGENT_JOB_QUEUES.refreshSuggestionsDeadLetter,
   retryLimit: 0,
   expireInSeconds: 60,
   retentionSeconds: 2_592_000,
   deleteAfterSeconds: 2_592_000,
   warningQueueSize: 1,
};

export const refreshThreadSuggestionsQueue = {
   name: AGENT_JOB_QUEUES.refreshSuggestions,
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
   deadLetter: AGENT_JOB_QUEUES.refreshSuggestionsDeadLetter,
};

export async function enqueueRefreshThreadSuggestionsJob(options: {
   boss: PgBossClient;
   input: RefreshThreadSuggestionsJobInput;
   tx?: DrizzleTransactionLike;
}) {
   const sendOptions: SendOptions = {
      retryLimit: refreshThreadSuggestionsQueue.retryLimit,
      retryDelay: refreshThreadSuggestionsQueue.retryDelay,
      retryBackoff: refreshThreadSuggestionsQueue.retryBackoff,
      retryDelayMax: refreshThreadSuggestionsQueue.retryDelayMax,
      expireInSeconds: refreshThreadSuggestionsQueue.expireInSeconds,
      retentionSeconds: refreshThreadSuggestionsQueue.retentionSeconds,
      deleteAfterSeconds: refreshThreadSuggestionsQueue.deleteAfterSeconds,
      heartbeatSeconds: refreshThreadSuggestionsQueue.heartbeatSeconds,
      deadLetter: refreshThreadSuggestionsQueue.deadLetter,
      group: { id: options.input.teamId },
   };
   if (options.tx) sendOptions.db = fromDrizzle(options.tx, sql);

   const jobId = await Result.tryPromise({
      try: () =>
         options.boss.sendDebounced(
            AGENT_JOB_QUEUES.refreshSuggestions,
            options.input,
            sendOptions,
            SUGGESTIONS_DEBOUNCE_SECONDS,
            options.input.threadId,
         ),
      catch: () =>
         new RefreshThreadSuggestionsJobError({
            error: refreshSuggestionsJobErrors.ENQUEUE_FAILED({
               internal: {
                  threadId: options.input.threadId,
                  messageCount: options.input.messageCount,
               },
            }),
            message: refreshSuggestionsJobErrors.ENQUEUE_FAILED({
               internal: {
                  threadId: options.input.threadId,
                  messageCount: options.input.messageCount,
               },
            }).message,
            threadId: options.input.threadId,
            messageCount: options.input.messageCount,
         }),
   });

   if (Result.isError(jobId)) return Result.err(jobId.error);
   if (!jobId.value) {
      return Result.err(
         new RefreshThreadSuggestionsJobError({
            error: refreshSuggestionsJobErrors.JOB_ID_MISSING({
               internal: { threadId: options.input.threadId },
            }),
            message: refreshSuggestionsJobErrors.JOB_ID_MISSING({
               internal: { threadId: options.input.threadId },
            }).message,
            threadId: options.input.threadId,
         }),
      );
   }
   return Result.ok(jobId.value);
}

export async function handleRefreshThreadSuggestionsJob(options: {
   db: DatabaseInstance;
   prompts: Prompts;
   job: Job<RefreshThreadSuggestionsJobInput>;
}) {
   return Result.gen(async function* () {
      const parsedInput = refreshThreadSuggestionsJobInputSchema.safeParse(
         options.job.data,
      );
      if (!parsedInput.success) {
         return Result.err(
            new RefreshThreadSuggestionsJobError({
               error: refreshSuggestionsJobErrors.INVALID_PAYLOAD({
                  internal: { jobId: options.job.id },
               }),
               message: refreshSuggestionsJobErrors.INVALID_PAYLOAD({
                  internal: { jobId: options.job.id },
               }).message,
            }),
         );
      }

      const input = parsedInput.data;
      log.info({
         module: "agents.refresh-suggestions-job",
         message: "running",
         jobId: options.job.id,
         threadId: input.threadId,
         teamId: input.teamId,
         organizationId: input.organizationId,
         messageCount: input.messageCount,
      });

      const recent = yield* Result.await(
         Result.tryPromise({
            try: () =>
               options.db.transaction(async (tx) => {
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
                     .orderBy(desc(messages.createdAt))
                     .limit(8);
                  return recent.slice().reverse();
               }),
            catch: () =>
               new RefreshThreadSuggestionsJobError({
                  error: refreshSuggestionsJobErrors.MESSAGES_LOAD_FAILED({
                     internal: {
                        jobId: options.job.id,
                        threadId: input.threadId,
                     },
                  }),
                  message: refreshSuggestionsJobErrors.MESSAGES_LOAD_FAILED({
                     internal: {
                        jobId: options.job.id,
                        threadId: input.threadId,
                     },
                  }).message,
                  threadId: input.threadId,
               }),
         }),
      );

      if (recent.length === 0) {
         log.info({
            module: "agents.refresh-suggestions-job",
            message: "skipping: no messages",
            jobId: options.job.id,
            threadId: input.threadId,
         });
         return Result.ok(undefined);
      }

      const hasUser = recent.some((row) => row.role === "user");
      const hasAssistant = recent.some((row) => row.role === "assistant");
      if (!hasUser || !hasAssistant) {
         log.info({
            module: "agents.refresh-suggestions-job",
            message: "skipping: conversation too shallow",
            jobId: options.job.id,
            threadId: input.threadId,
         });
         return Result.ok(undefined);
      }

      const prompt = yield* Result.await(
         Result.tryPromise({
            try: () =>
               options.prompts.get(AGENT_PROMPTS.refreshSuggestions, {
                  withMetadata: true,
               }),
            catch: () =>
               new RefreshThreadSuggestionsJobError({
                  error: refreshSuggestionsJobErrors.PROMPT_LOAD_FAILED({
                     internal: {
                        jobId: options.job.id,
                        threadId: input.threadId,
                     },
                  }),
                  message: refreshSuggestionsJobErrors.PROMPT_LOAD_FAILED({
                     internal: {
                        jobId: options.job.id,
                        threadId: input.threadId,
                     },
                  }).message,
                  threadId: input.threadId,
               }),
         }),
      );

      const suggestions = yield* Result.await(
         Result.tryPromise({
            try: () =>
               chat({
                  adapter: flashModel,
                  outputSchema: suggestionsSchema,
                  messages: convertMessagesToModelMessages([
                     ...recent,
                     {
                        id: `${options.job.id}-suggestions-request`,
                        role: "user",
                        parts: [
                           {
                              type: "text",
                              content: options.prompts.compile(prompt.prompt, {
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
                              promptName: prompt.name,
                              promptVersion: prompt.version,
                              customProperties: {
                                 agent_role: "job",
                                 agent_workflow: "refresh-suggestions",
                                 agent_thread_id: input.threadId,
                                 pg_boss_job_id: options.job.id,
                              },
                           }),
                     }),
                  ],
               }),
            catch: () =>
               new RefreshThreadSuggestionsJobError({
                  error: refreshSuggestionsJobErrors.AI_FAILED({
                     internal: {
                        jobId: options.job.id,
                        threadId: input.threadId,
                     },
                  }),
                  message: refreshSuggestionsJobErrors.AI_FAILED({
                     internal: {
                        jobId: options.job.id,
                        threadId: input.threadId,
                     },
                  }).message,
                  threadId: input.threadId,
               }),
         }),
      );

      yield* Result.await(
         Result.tryPromise({
            try: () =>
               options.db.transaction(async (tx) => {
                  await tx
                     .update(threads)
                     .set({
                        suggestions,
                        suggestionsUpdatedAt: dayjs().toDate(),
                     })
                     .where(
                        and(
                           eq(threads.id, input.threadId),
                           eq(threads.teamId, input.teamId),
                           eq(threads.organizationId, input.organizationId),
                        ),
                     );
               }),
            catch: () =>
               new RefreshThreadSuggestionsJobError({
                  error: refreshSuggestionsJobErrors.WRITE_FAILED({
                     internal: {
                        jobId: options.job.id,
                        threadId: input.threadId,
                     },
                  }),
                  message: refreshSuggestionsJobErrors.WRITE_FAILED({
                     internal: {
                        jobId: options.job.id,
                        threadId: input.threadId,
                     },
                  }).message,
                  threadId: input.threadId,
               }),
         }),
      );

      log.info({
         module: "agents.refresh-suggestions-job",
         message: "completed",
         jobId: options.job.id,
         threadId: input.threadId,
         suggestionsCount: suggestions.length,
      });
      return Result.ok(undefined);
   });
}
