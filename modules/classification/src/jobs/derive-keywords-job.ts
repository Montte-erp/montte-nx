import { defineErrorCatalog } from "evlog";
import { Result, TaggedError } from "better-result";
import { chat } from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import dayjs from "dayjs";
import { and, eq, sql } from "drizzle-orm";
import {
   fromDrizzle,
   type DrizzleTransactionLike,
   type Job,
   type SendOptions,
} from "pg-boss";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import { categories, categorySchema } from "@core/database/schemas/categories";
import { getAiTracer, log } from "@core/logging";
import { defaultPgBossWorkOptions } from "@core/pg-boss/worker";
import type { PgBossClient } from "@core/pg-boss/client";
import type { Prompts } from "@core/posthog/server";
import { proModel } from "@core/ai/models";
import { aiTraceAttributes, type AiTraceContext } from "@core/ai/otel";

const DERIVE_KEYWORDS_PROMPT = "montte-derive-keywords";
const DERIVE_KEYWORDS_QUEUE = "classification:derive-keywords";
const DERIVE_KEYWORDS_DEAD_LETTER_QUEUE =
   "classification:derive-keywords:dead-letter";

export const deriveKeywordsJobInputSchema = z.object({
   categoryId: z.string().uuid(),
   teamId: z.string().uuid(),
   organizationId: z.string().uuid(),
   name: z.string().min(1),
   description: z.string().nullable().optional(),
   userId: z.string().uuid().optional(),
});

export type DeriveKeywordsJobInput = z.infer<
   typeof deriveKeywordsJobInputSchema
>;

const deriveKeywordsJobErrors = defineErrorCatalog(
   "classification.job.keywords",
   {
      PROMPT_LOAD_FAILED: {
         status: 500,
         message: "Falha ao carregar prompt de palavras-chave.",
         tags: ["classification", "pg-boss", "keywords", "ai"],
      },
      ENQUEUE_FAILED: {
         status: 500,
         message: "Falha ao enfileirar derivação de palavras-chave.",
         tags: ["classification", "pg-boss", "keywords"],
      },
      JOB_ID_MISSING: {
         status: 500,
         message:
            "Pg-boss não retornou o ID do job de derivação de palavras-chave.",
         tags: ["classification", "pg-boss", "keywords"],
      },
      INVALID_PAYLOAD: {
         status: 400,
         message: "Payload inválido para derivação de palavras-chave.",
         tags: ["classification", "pg-boss", "keywords"],
      },
      SIBLINGS_LOAD_FAILED: {
         status: 500,
         message: "Falha ao carregar palavras-chave das categorias irmãs.",
         tags: ["classification", "pg-boss", "keywords"],
      },
      AI_FAILED: {
         status: 500,
         message: "Falha ao derivar palavras-chave por IA.",
         tags: ["classification", "pg-boss", "keywords"],
      },
      WRITE_FAILED: {
         status: 500,
         message: "Falha ao gravar palavras-chave da categoria.",
         tags: ["classification", "pg-boss", "keywords"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "classification.job.keywords": typeof deriveKeywordsJobErrors;
   }
}

type DeriveKeywordsJobCatalogError =
   | ReturnType<typeof deriveKeywordsJobErrors.PROMPT_LOAD_FAILED>
   | ReturnType<typeof deriveKeywordsJobErrors.ENQUEUE_FAILED>
   | ReturnType<typeof deriveKeywordsJobErrors.JOB_ID_MISSING>
   | ReturnType<typeof deriveKeywordsJobErrors.INVALID_PAYLOAD>
   | ReturnType<typeof deriveKeywordsJobErrors.SIBLINGS_LOAD_FAILED>
   | ReturnType<typeof deriveKeywordsJobErrors.AI_FAILED>
   | ReturnType<typeof deriveKeywordsJobErrors.WRITE_FAILED>;

export class DeriveKeywordsJobError extends TaggedError(
   "DeriveKeywordsJobError",
)<{
   error: DeriveKeywordsJobCatalogError;
   message: string;
   categoryId?: string;
}>() {}

const DERIVE_KEYWORDS_DEBOUNCE_SECONDS = 20;
const KEYWORDS_MIN = 5;
const KEYWORDS_MAX = 15;

export const deriveKeywordsInputSchema = categorySchema
   .pick({ name: true, description: true })
   .extend({ siblingKeywords: z.array(z.string()).optional() });

export type DeriveKeywordsInput = z.infer<typeof deriveKeywordsInputSchema>;

const deriveKeywordsOutputSchema = z.object({
   keywords: z
      .array(z.string().min(1).max(60))
      .min(KEYWORDS_MIN)
      .max(KEYWORDS_MAX),
});

function buildDeriveKeywordsUserMessage(input: DeriveKeywordsInput) {
   const lines = [`Categoria: ${input.name}`];
   if (input.description) lines.push(`Descrição: ${input.description}`);
   if (input.siblingKeywords?.length) {
      lines.push(
         `Palavras-chave já usadas por outras categorias do time (NÃO repetir): ${input.siblingKeywords.join(", ")}`,
      );
   }
   return lines.join("\n");
}

export async function deriveKeywords(options: {
   prompts: Prompts;
   input: DeriveKeywordsInput;
   observability: AiTraceContext;
}) {
   return Result.gen(async function* () {
      const { prompt, name, version } = yield* Result.await(
         Result.tryPromise({
            try: () =>
               options.prompts.get(DERIVE_KEYWORDS_PROMPT, {
                  withMetadata: true,
               }),
            catch: () =>
               new DeriveKeywordsJobError({
                  error: deriveKeywordsJobErrors.PROMPT_LOAD_FAILED(),
                  message: "Falha ao carregar prompt de palavras-chave.",
               }),
         }),
      );

      const result = yield* Result.await(
         Result.tryPromise({
            try: () =>
               chat({
                  adapter: proModel,
                  systemPrompts: [
                     options.prompts.compile(prompt, {
                        min_keywords: KEYWORDS_MIN,
                        max_keywords: KEYWORDS_MAX,
                     }),
                  ],
                  messages: [
                     {
                        role: "user",
                        content: [
                           {
                              type: "text",
                              content: buildDeriveKeywordsUserMessage(
                                 options.input,
                              ),
                           },
                        ],
                     },
                  ],
                  outputSchema: deriveKeywordsOutputSchema,
                  stream: false,
                  middleware: [
                     otelMiddleware({
                        tracer: getAiTracer(),
                        captureContent: false,
                        attributeEnricher: () =>
                           aiTraceAttributes({
                              ...options.observability,
                              promptName: name,
                              promptVersion: version,
                           }),
                     }),
                  ],
               }),
            catch: () =>
               new DeriveKeywordsJobError({
                  error: deriveKeywordsJobErrors.AI_FAILED(),
                  message: "Falha ao derivar palavras-chave por IA.",
               }),
         }),
      );

      return Result.ok(result.keywords);
   });
}

export const deriveKeywordsDeadLetterQueue = {
   name: DERIVE_KEYWORDS_DEAD_LETTER_QUEUE,
   retryLimit: 0,
   expireInSeconds: 60,
   retentionSeconds: 2_592_000,
   deleteAfterSeconds: 2_592_000,
   warningQueueSize: 1,
};

export const deriveKeywordsQueue = {
   name: DERIVE_KEYWORDS_QUEUE,
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
   deadLetter: DERIVE_KEYWORDS_DEAD_LETTER_QUEUE,
};

export async function enqueueDeriveKeywordsJob(options: {
   boss: PgBossClient;
   input: DeriveKeywordsJobInput;
   tx?: DrizzleTransactionLike;
}) {
   const sendOptions: SendOptions = {
      singletonKey: options.input.categoryId,
      retryLimit: deriveKeywordsQueue.retryLimit,
      retryDelay: deriveKeywordsQueue.retryDelay,
      retryBackoff: deriveKeywordsQueue.retryBackoff,
      retryDelayMax: deriveKeywordsQueue.retryDelayMax,
      expireInSeconds: deriveKeywordsQueue.expireInSeconds,
      retentionSeconds: deriveKeywordsQueue.retentionSeconds,
      deleteAfterSeconds: deriveKeywordsQueue.deleteAfterSeconds,
      heartbeatSeconds: deriveKeywordsQueue.heartbeatSeconds,
      deadLetter: deriveKeywordsQueue.deadLetter,
      group: { id: options.input.teamId },
   };
   if (options.tx) sendOptions.db = fromDrizzle(options.tx, sql);

   const jobId = await Result.tryPromise({
      try: () =>
         options.boss.sendDebounced(
            DERIVE_KEYWORDS_QUEUE,
            options.input,
            sendOptions,
            DERIVE_KEYWORDS_DEBOUNCE_SECONDS,
            options.input.categoryId,
         ),
      catch: () =>
         new DeriveKeywordsJobError({
            error: deriveKeywordsJobErrors.ENQUEUE_FAILED({
               internal: { categoryId: options.input.categoryId },
            }),
            message: "Falha ao enfileirar derivação de palavras-chave.",
            categoryId: options.input.categoryId,
         }),
   });

   if (Result.isError(jobId)) return Result.err(jobId.error);
   if (!jobId.value) {
      return Result.err(
         new DeriveKeywordsJobError({
            error: deriveKeywordsJobErrors.JOB_ID_MISSING({
               internal: { categoryId: options.input.categoryId },
            }),
            message:
               "Pg-boss não retornou o ID do job de derivação de palavras-chave.",
            categoryId: options.input.categoryId,
         }),
      );
   }
   return Result.ok(jobId.value);
}

export async function handleDeriveKeywordsJob(options: {
   db: DatabaseInstance;
   prompts: Prompts;
   job: Job<DeriveKeywordsJobInput>;
}) {
   const parsedInput = deriveKeywordsJobInputSchema.safeParse(options.job.data);
   if (!parsedInput.success) {
      return Result.err(
         new DeriveKeywordsJobError({
            error: deriveKeywordsJobErrors.INVALID_PAYLOAD({
               internal: { jobId: options.job.id },
            }),
            message: "Payload inválido para derivação de palavras-chave.",
         }),
      );
   }

   const input = parsedInput.data;
   log.info({
      module: "classification.derive-keywords-job",
      message: "running",
      jobId: options.job.id,
      categoryId: input.categoryId,
      teamId: input.teamId,
      organizationId: input.organizationId,
      promptName: DERIVE_KEYWORDS_PROMPT,
   });

   const siblingKeywords = await Result.tryPromise({
      try: async () => {
         const rows = await options.db.query.categories.findMany({
            where: (f, { and, eq: eqFn, ne, isNotNull }) =>
               and(
                  eqFn(f.teamId, input.teamId),
                  ne(f.id, input.categoryId),
                  isNotNull(f.keywords),
               ),
            columns: { keywords: true },
         });
         return [...new Set(rows.flatMap((row) => row.keywords ?? []))].sort();
      },
      catch: () =>
         new DeriveKeywordsJobError({
            error: deriveKeywordsJobErrors.SIBLINGS_LOAD_FAILED({
               internal: {
                  jobId: options.job.id,
                  categoryId: input.categoryId,
               },
            }),
            message: "Falha ao carregar palavras-chave das categorias irmãs.",
            categoryId: input.categoryId,
         }),
   });
   if (Result.isError(siblingKeywords))
      return Result.err(siblingKeywords.error);

   const derived = await deriveKeywords({
      prompts: options.prompts,
      input: {
         name: input.name,
         description: input.description ?? null,
         siblingKeywords: siblingKeywords.value,
      },
      observability: {
         distinctId: input.userId ?? input.teamId,
         organizationId: input.organizationId,
         teamId: input.teamId,
      },
   });
   if (Result.isError(derived)) {
      return Result.err(
         new DeriveKeywordsJobError({
            error: deriveKeywordsJobErrors.AI_FAILED({
               internal: {
                  jobId: options.job.id,
                  categoryId: input.categoryId,
               },
            }),
            message: "Falha ao derivar palavras-chave por IA.",
            categoryId: input.categoryId,
         }),
      );
   }

   const used = new Set(
      siblingKeywords.value.map((keyword) => keyword.toLowerCase()),
   );
   const keywords = derived.value.filter(
      (keyword) => !used.has(keyword.toLowerCase()),
   );

   if (keywords.length === 0) {
      log.warn({
         module: "classification.derive-keywords-job",
         message: "skipping: all derived keywords collide with siblings",
         jobId: options.job.id,
         categoryId: input.categoryId,
      });
      return Result.ok(undefined);
   }

   const write = await Result.tryPromise({
      try: () =>
         options.db.transaction(async (tx) => {
            await tx
               .update(categories)
               .set({
                  keywords,
                  keywordsUpdatedAt: dayjs().toDate(),
               })
               .where(
                  and(
                     eq(categories.id, input.categoryId),
                     eq(categories.teamId, input.teamId),
                  ),
               );
         }),
      catch: () =>
         new DeriveKeywordsJobError({
            error: deriveKeywordsJobErrors.WRITE_FAILED({
               internal: {
                  jobId: options.job.id,
                  categoryId: input.categoryId,
               },
            }),
            message: "Falha ao gravar palavras-chave da categoria.",
            categoryId: input.categoryId,
         }),
   });
   if (Result.isError(write)) return Result.err(write.error);

   log.info({
      module: "classification.derive-keywords-job",
      message: "completed",
      jobId: options.job.id,
      categoryId: input.categoryId,
      keywordsCount: keywords.length,
   });
   return Result.ok(undefined);
}

export const classificationPgBossQueues = [
   deriveKeywordsDeadLetterQueue,
   deriveKeywordsQueue,
];

export async function registerClassificationPgBossJobs(options: {
   boss: PgBossClient;
   db: DatabaseInstance;
   prompts: Prompts;
}) {
   await options.boss.work<DeriveKeywordsJobInput>(
      deriveKeywordsQueue.name,
      defaultPgBossWorkOptions,
      async (jobs) => {
         const errors: Error[] = [];
         for (const job of jobs) {
            const result = await handleDeriveKeywordsJob({
               db: options.db,
               prompts: options.prompts,
               job,
            });
            if (Result.isError(result)) errors.push(result.error);
         }
         if (errors.length > 0) {
            throw new AggregateError(errors);
         }
      },
   );
}
