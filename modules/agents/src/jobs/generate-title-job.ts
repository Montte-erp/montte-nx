import { chat } from "@tanstack/ai";
import { Result, TaggedError } from "better-result";
import { asc, eq, sql } from "drizzle-orm";
import {
   fromDrizzle,
   type DrizzleTransactionLike,
   type Job,
   type SendOptions,
} from "pg-boss";
import { z } from "zod";
import { flashModel } from "@core/ai/models";
import { createAiObservabilityMiddleware } from "@core/ai/middleware";
import type { DatabaseInstance } from "@core/database/client";
import { messages } from "@core/database/schemas/messages";
import { threads } from "@core/database/schemas/threads";
import { getLogger } from "@core/logging/root";
import type { PgBossClient } from "@core/pg-boss/client";
import type { Prompts } from "@core/posthog/server";
import { AGENT_PROMPTS, AGENT_QUEUES } from "../constants";
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
      | "write_title";
   message: string;
   threadId?: string;
   cause?: unknown;
}>() {}

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
   const queue = await Result.tryPromise({
      try: () =>
         options.boss.createQueue(
            generateThreadTitleQueue.name,
            generateThreadTitleQueue,
         ),
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
      expireInSeconds: generateThreadTitleQueue.expireInSeconds,
      retentionSeconds: generateThreadTitleQueue.retentionSeconds,
      deleteAfterSeconds: generateThreadTitleQueue.deleteAfterSeconds,
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
            operation: "parse_input",
            message: "Payload inválido para geração de título.",
            cause: parsedInput.error,
         }),
      );
   }

   const input = parsedInput.data;
   const ctx = `[pg-boss generate-title] thread=${input.threadId}`;
   logger.info({ jobId: options.job.id, threadId: input.threadId }, "running");

   const recent = await Result.tryPromise({
      try: () =>
         options.db.transaction(async (tx) => {
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
         }),
      catch: (cause) =>
         new GenerateThreadTitleJobError({
            operation: "load_recent_messages",
            message: "Falha ao carregar mensagens recentes para título.",
            threadId: input.threadId,
            cause,
         }),
   });

   if (Result.isError(recent)) {
      return Result.err(recent.error);
   }
   if (!recent.value || recent.value.length === 0) {
      logger.info(`${ctx} skipping: no messages or title already set`);
      return Result.ok(undefined);
   }

   const transcript = conversationTranscript(recent.value);
   if (
      transcript.length < MIN_TITLE_TRANSCRIPT_LENGTH ||
      !hasUserAndAssistantText(recent.value)
   ) {
      logger.info(`${ctx} skipping: conversation too shallow`);
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
               createAiObservabilityMiddleware({
                  distinctId: input.teamId,
                  organizationId: input.organizationId,
                  teamId: input.teamId,
                  conversationId: input.threadId,
                  promptName: prompt.value.name,
                  promptVersion: prompt.value.version,
                  customProperties: {
                     agent_role: "job",
                     agent_workflow: "generate-title",
                     agent_thread_id: input.threadId,
                  },
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
      logger.warn(`${ctx} empty title generated: skipping`);
      return Result.ok(undefined);
   }

   const write = await Result.tryPromise({
      try: () =>
         options.db.transaction(async (tx) => {
            await tx
               .update(threads)
               .set({ title })
               .where(eq(threads.id, input.threadId));
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

   logger.info({ threadId: input.threadId, title }, "completed");
   return Result.ok(undefined);
}
