import { DBOS } from "@dbos-inc/dbos-sdk";
import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { chat } from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { createStore } from "@tanstack/store";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { flashModel } from "@core/ai/models";
import { aiTraceAttributes, type AiTraceContext } from "@core/ai/otel";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { registerWorkflowOnce } from "@core/dbos/factory";
import type { DbosWorkerQueue } from "@core/dbos/worker";
import { env } from "@core/environment/worker";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import { getAiTracer } from "@core/logging";
import type { Prompts } from "@core/posthog/server";
import {
   buildClassifyTransactionsBatchWorkflowId,
   CLASSIFICATION_WORKFLOW_QUEUES,
   CLASSIFICATION_WORKFLOWS,
   type ClassifyTransactionsBatchInput,
} from "@modules/classification/workflows/enqueue";

const CLASSIFY_TRANSACTION_PROMPT = "montte-classify-transaction";
const AI_CHUNK_SIZE = 20;
const MAX_BATCH_SIZE = 20;

const throwableCauseSchema = z.object({
   name: z.string().optional(),
   message: z.string().optional(),
});

export const classificationDataSource = new DrizzleDataSource<DatabaseInstance>(
   "classification",
   { connectionString: env.DATABASE_URL },
   schema,
);

type ClassificationWorkflowContext = {
   prompts: Prompts | null;
};

const store = createStore<ClassificationWorkflowContext>({
   prompts: null,
});

export function initClassificationWorkflowContext(prompts: Prompts) {
   store.setState(() => ({
      prompts,
   }));
}

export function createClassificationQueues(options: {
   workerConcurrency: number;
}): DbosWorkerQueue[] {
   return Object.values(CLASSIFICATION_WORKFLOW_QUEUES).map((name) => ({
      name,
      options,
   }));
}

const classifyBatchWorkflowErrors = defineErrorCatalog(
   "classification.workflow.classify",
   {
      BATCH_TOO_LARGE: {
         status: 500,
         message: "Batch maior que 20. Faça chunk antes de chamar.",
         tags: ["classification", "workflow", "ai"],
      },
      PROMPT_LOAD_FAILED: {
         status: 500,
         message: "Falha ao carregar prompt de classificação.",
         tags: ["classification", "workflow", "ai"],
      },
      AI_FAILED: {
         status: 500,
         message: "Falha na classificação por IA em lote.",
         tags: ["classification", "workflow", "ai"],
      },
      INPUT_LOAD_FAILED: {
         status: 500,
         message: "Falha ao carregar dados de classificação.",
         tags: ["classification", "workflow"],
      },
      WRITE_FAILED: {
         status: 500,
         message: "Falha ao gravar classificações.",
         tags: ["classification", "workflow"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "classification.workflow.classify": typeof classifyBatchWorkflowErrors;
   }
}

type ClassifyBatchWorkflowCatalogError =
   | ReturnType<typeof classifyBatchWorkflowErrors.BATCH_TOO_LARGE>
   | ReturnType<typeof classifyBatchWorkflowErrors.PROMPT_LOAD_FAILED>
   | ReturnType<typeof classifyBatchWorkflowErrors.AI_FAILED>
   | ReturnType<typeof classifyBatchWorkflowErrors.INPUT_LOAD_FAILED>
   | ReturnType<typeof classifyBatchWorkflowErrors.WRITE_FAILED>;

class ClassifyBatchWorkflowError extends TaggedError(
   "ClassifyBatchWorkflowError",
)<{
   error: ClassifyBatchWorkflowCatalogError;
   message: string;
   batchId?: string;
   teamId?: string;
   organizationId?: string;
}>() {}

const serializeUnknownCause = (cause: unknown) => {
   const parsed = throwableCauseSchema.safeParse(cause);
   if (parsed.success) {
      return {
         name: parsed.data.name ?? "UnknownError",
         message: parsed.data.message ?? "Falha sem mensagem.",
      };
   }
   return { type: typeof cause };
};

function getClassificationPrompts(): Prompts {
   const { prompts } = store.state;
   if (prompts) return prompts;
   throw new ClassifyBatchWorkflowError({
      error: classifyBatchWorkflowErrors.PROMPT_LOAD_FAILED({
         internal: { reason: "context_not_initialized" },
      }),
      message: "Contexto do workflow de classificação não inicializado.",
   });
}

const classifyBatchInputSchema = z.object({
   id: z.string(),
   name: z.string(),
   type: z.enum(["income", "expense"]),
   contactName: z.string().nullish(),
});

const classifyBatchOptionSchema = z.object({
   id: z.string(),
   name: z.string(),
   path: z.string(),
   type: z.enum(["income", "expense", "transfer"]),
   hasChildren: z.boolean(),
});

const classifyBatchOutputSchema = z.object({
   results: z.array(
      z.object({
         id: z.string(),
         categoryId: z.string().nullable(),
         categoryName: z.string().nullable(),
      }),
   ),
});

type ClassifyBatchInput = z.infer<typeof classifyBatchInputSchema>;
type ClassifyBatchOption = z.infer<typeof classifyBatchOptionSchema>;
type ClassifyBatchResult = {
   transactionId: string;
   categoryId: string;
};

type CategoryRow = {
   id: string;
   name: string;
   parentId: string | null;
   level: number;
   dreGroupId: string | null;
   type: "income" | "expense" | "transfer";
};

type LoadedTransaction = {
   id: string;
   teamId: string;
   name: string | null;
   type: "income" | "expense" | "transfer";
   contactName: string | null;
};

type LoadedInputs = {
   transactions: LoadedTransaction[];
   categories: CategoryRow[];
   tagByName: Map<string, string>;
};

type ClassificationWrite = {
   transactionId: string;
   categoryId: string;
   tagId: string | null;
};

function chunk<T>(items: T[], size: number): T[][] {
   const out: T[][] = [];
   for (let i = 0; i < items.length; i += size)
      out.push(items.slice(i, i + size));
   return out;
}

function resolveTagId(
   categoryId: string,
   categoryById: Map<string, CategoryRow>,
   tagByName: Map<string, string>,
): string | null {
   const dreGroupId = categoryById.get(categoryId)?.dreGroupId;
   if (!dreGroupId) return null;
   return tagByName.get(dreGroupId) ?? null;
}

function buildCategoryOptions(rows: CategoryRow[]): ClassifyBatchOption[] {
   const byId = new Map(rows.map((row) => [row.id, row]));
   const parentIds = new Set(
      rows.flatMap((row) => (row.parentId ? [row.parentId] : [])),
   );
   const buildPath = (row: CategoryRow): string => {
      const names = [row.name];
      let parentId = row.parentId;
      while (parentId) {
         const parent = byId.get(parentId);
         if (!parent) break;
         names.unshift(parent.name);
         parentId = parent.parentId;
      }
      return names.join(" > ");
   };

   return rows
      .map((row) => ({
         id: row.id,
         name: row.name,
         path: buildPath(row),
         type: row.type,
         hasChildren: parentIds.has(row.id),
      }))
      .sort((a, b) => a.path.localeCompare(b.path, "pt-BR"));
}

function formatCategory(c: ClassifyBatchOption) {
   const hint = c.hasChildren
      ? " (categoria pai/grupo; use apenas se nenhuma subcategoria for segura)"
      : "";
   const translatedType =
      c.type === "income"
         ? "receita"
         : c.type === "expense"
           ? "despesa"
           : "transferência";
   return `- [id=${c.id}] (${translatedType}) ${c.path}${hint}`;
}

function formatTransaction(tx: ClassifyBatchInput) {
   const translatedType =
      tx.type === "income"
         ? "Receita"
         : tx.type === "expense"
           ? "Despesa"
           : "Transferência";
   const parts = [
      `[id=${tx.id}]`,
      `Nome: ${tx.name}`,
      `Tipo: ${translatedType}`,
   ];
   if (tx.contactName) parts.push(`Contato: ${tx.contactName}`);
   return parts.join("\n");
}

function resolveAiResults(
   raw: {
      id: string;
      categoryId: string | null;
      categoryName: string | null;
   }[],
   inputTransactions: ClassifyBatchInput[],
   inputCategories: ClassifyBatchOption[],
): ClassifyBatchResult[] {
   const inputIds = new Set(inputTransactions.map((tx) => tx.id));
   const transactionTypeById = new Map(
      inputTransactions.map((tx) => [tx.id, tx.type]),
   );
   const categoryById = new Map(inputCategories.map((c) => [c.id, c]));
   const categoryByTypePath = new Map<string, string>();
   const categoryIdsByTypeName = new Map<string, string[]>();

   for (const category of inputCategories) {
      const typePathKey = `${category.type}:${category.path.trim().toLocaleLowerCase()}`;
      categoryByTypePath.set(typePathKey, category.id);
      const typeNameKey = `${category.type}:${category.name
         .trim()
         .toLocaleLowerCase()}`;
      const list = categoryIdsByTypeName.get(typeNameKey);
      if (list) {
         list.push(category.id);
      } else {
         categoryIdsByTypeName.set(typeNameKey, [category.id]);
      }
   }

   return raw.flatMap((entry) => {
      if (!inputIds.has(entry.id)) return [];
      const txType = transactionTypeById.get(entry.id);
      if (!txType) return [];

      const categoryId = entry.categoryId?.trim();
      if (categoryId) {
         const candidate = categoryById.get(categoryId);
         if (candidate && candidate.type === txType) {
            return [{ transactionId: entry.id, categoryId }];
         }
      }

      if (!entry.categoryName) return [];
      const normalized = entry.categoryName.trim().toLocaleLowerCase();
      const pathMatch = categoryByTypePath.get(`${txType}:${normalized}`);
      if (pathMatch) {
         return [{ transactionId: entry.id, categoryId: pathMatch }];
      }

      const candidates = categoryIdsByTypeName.get(`${txType}:${normalized}`);
      if (!candidates || candidates.length !== 1) return [];
      const resolvedId = candidates[0];
      if (!resolvedId) return [];
      return [{ transactionId: entry.id, categoryId: resolvedId }];
   });
}

async function classifyTransactionsBatch(options: {
   transactions: ClassifyBatchInput[];
   categories: ClassifyBatchOption[];
   observability: AiTraceContext;
}) {
   if (options.transactions.length > MAX_BATCH_SIZE) {
      return Result.err(
         new ClassifyBatchWorkflowError({
            error: classifyBatchWorkflowErrors.BATCH_TOO_LARGE(),
            message: "Batch maior que 20. Faça chunk antes de chamar.",
         }),
      );
   }

   return Result.gen(async function* () {
      const { prompt, name, version } = yield* Result.await(
         Result.tryPromise({
            try: () =>
               getClassificationPrompts().get(CLASSIFY_TRANSACTION_PROMPT, {
                  withMetadata: true,
               }),
            catch: () =>
               new ClassifyBatchWorkflowError({
                  error: classifyBatchWorkflowErrors.PROMPT_LOAD_FAILED(),
                  message: "Falha ao carregar prompt de classificação.",
               }),
         }),
      );

      const response = yield* Result.await(
         Result.tryPromise({
            try: () =>
               chat({
                  adapter: flashModel,
                  systemPrompts: [
                     getClassificationPrompts().compile(prompt, {
                        category_list: options.categories
                           .map(formatCategory)
                           .join("\n"),
                     }),
                     "Escolha sempre uma categoria existente da lista e retorne preferencialmente categoryId. Quando uma categoria pai tiver subcategorias adequadas, prefira a subcategoria mais específica; use a categoria pai apenas quando nenhuma subcategoria for segura.",
                  ],
                  messages: [
                     {
                        role: "user",
                        content: [
                           {
                              type: "text",
                              content: options.transactions
                                 .map(formatTransaction)
                                 .join("\n\n"),
                           },
                        ],
                     },
                  ],
                  outputSchema: classifyBatchOutputSchema,
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
               new ClassifyBatchWorkflowError({
                  error: classifyBatchWorkflowErrors.AI_FAILED(),
                  message: "Falha na classificação por IA em lote.",
               }),
         }),
      );

      return Result.ok(
         resolveAiResults(
            response.results,
            options.transactions,
            options.categories,
         ),
      );
   });
}

const stepLoadInputs = (input: ClassifyTransactionsBatchInput) =>
   DBOS.runStep(
      () =>
         classificationDataSource.runTransaction(
            async (): Promise<LoadedInputs> => {
               const tx = classificationDataSource.client;
               const txRows = await tx.query.transactions.findMany({
                  where: (f, { and, eq, inArray, isNull }) =>
                     and(
                        eq(f.teamId, input.teamId),
                        eq(f.ignored, false),
                        inArray(f.id, input.transactionIds),
                        isNull(f.categoryId),
                        isNull(f.suggestedCategoryId),
                     ),
               });
               const catRows = await tx
                  .select({
                     id: categories.id,
                     name: categories.name,
                     parentId: categories.parentId,
                     level: categories.level,
                     type: categories.type,
                     dreGroupId: categories.dreGroupId,
                  })
                  .from(categories)
                  .where(
                     and(
                        eq(categories.teamId, input.teamId),
                        eq(categories.isArchived, false),
                     ),
                  );
               const tagRows = await tx
                  .select({ id: tags.id, name: tags.name })
                  .from(tags)
                  .where(
                     and(
                        eq(tags.teamId, input.teamId),
                        eq(tags.isArchived, false),
                     ),
                  );
               return {
                  transactions: txRows.map((row) => ({
                     id: row.id,
                     teamId: row.teamId,
                     name: row.name,
                     type: row.type,
                     contactName: null,
                  })),
                  categories: catRows,
                  tagByName: new Map(tagRows.map((t) => [t.name, t.id])),
               };
            },
            { name: "load-classification-inputs" },
         ),
      { name: "load-classification-inputs" },
   );

const stepAiChunk = (
   chunkItems: (LoadedTransaction & { name: string })[],
   options: ClassifyBatchOption[],
   teamId: string,
   organizationId: string,
   index: number,
) =>
   DBOS.runStep(
      async (): Promise<ClassifyBatchResult[]> => {
         const aiInput: ClassifyBatchInput[] = chunkItems
            .filter((t) => t.type !== "transfer")
            .map((t) => ({
               id: t.id,
               name: t.name,
               type: t.type === "income" ? "income" : "expense",
               contactName: t.contactName,
            }));
         if (aiInput.length === 0) return [];
         const ai = await classifyTransactionsBatch({
            transactions: aiInput,
            categories: options,
            observability: { distinctId: teamId, teamId, organizationId },
         });
         if (Result.isError(ai)) throw ai.error;
         return ai.value;
      },
      { name: `ai-classify-chunk-${index + 1}` },
   );

const stepWrite = (writes: ClassificationWrite[], teamId: string) =>
   DBOS.runStep(
      () =>
         classificationDataSource.runTransaction(
            async () => {
               const tx = classificationDataSource.client;
               for (const w of writes) {
                  await tx
                     .update(transactions)
                     .set({
                        suggestedCategoryId: w.categoryId,
                        ...(w.tagId ? { suggestedTagId: w.tagId } : {}),
                     })
                     .where(
                        and(
                           eq(transactions.id, w.transactionId),
                           eq(transactions.teamId, teamId),
                           eq(transactions.ignored, false),
                           isNull(transactions.categoryId),
                           isNull(transactions.suggestedCategoryId),
                        ),
                     );
               }
            },
            { name: "write-classifications" },
         ),
      { name: "write-classifications" },
   );

async function classifyTransactionsBatchWorkflowFn(
   input: ClassifyTransactionsBatchInput,
) {
   const batchId = buildClassifyTransactionsBatchWorkflowId(input);
   const total = input.transactionIds.length;
   const log = `[classify-batch] team=${input.teamId} count=${total} batch=${batchId}`;
   DBOS.logger.info(`${log} started`);

   if (total === 0) {
      DBOS.logger.info(`${log} empty input — nothing to classify`);
      return;
   }

   const loadResult = await Result.tryPromise({
      try: () => stepLoadInputs(input),
      catch: (cause) =>
         new ClassifyBatchWorkflowError({
            error: classifyBatchWorkflowErrors.INPUT_LOAD_FAILED({
               internal: { cause: serializeUnknownCause(cause) },
            }),
            message: "Falha ao carregar dados de classificação.",
            batchId,
            teamId: input.teamId,
            organizationId: input.organizationId,
         }),
   });
   if (Result.isError(loadResult)) throw loadResult.error;
   const loaded = loadResult.value;

   if (loaded.transactions.length === 0) {
      DBOS.logger.info(
         `${log} no pending transactions to classify — already classified or filtered out`,
      );
      return;
   }

   const categoryById = new Map(loaded.categories.map((c) => [c.id, c]));
   const categoryOptions = buildCategoryOptions(loaded.categories);
   const named = loaded.transactions.filter(
      (t): t is LoadedTransaction & { name: string } => t.name !== null,
   );

   const aiResults: ClassifyBatchResult[] = [];
   if (named.length > 0 && categoryOptions.length > 0) {
      const chunks = chunk(named, AI_CHUNK_SIZE);
      for (let i = 0; i < chunks.length; i += 1) {
         const chunkItems = chunks[i];
         if (!chunkItems) continue;
         const ai = await Result.tryPromise({
            try: () =>
               stepAiChunk(
                  chunkItems,
                  categoryOptions,
                  input.teamId,
                  input.organizationId,
                  i,
               ),
            catch: (cause) =>
               new ClassifyBatchWorkflowError({
                  error: classifyBatchWorkflowErrors.AI_FAILED({
                     internal: { cause: serializeUnknownCause(cause) },
                  }),
                  message: "Falha ao classificar transações com IA.",
                  batchId,
                  teamId: input.teamId,
                  organizationId: input.organizationId,
               }),
         });
         if (Result.isError(ai)) throw ai.error;
         aiResults.push(...ai.value);
      }
   }

   const writes: ClassificationWrite[] = [
      ...aiResults.map((r) => ({
         transactionId: r.transactionId,
         categoryId: r.categoryId,
         tagId: resolveTagId(r.categoryId, categoryById, loaded.tagByName),
      })),
   ];

   if (writes.length === 0) {
      DBOS.logger.info(`${log} no classifications produced — exiting`);
      return;
   }

   const writeResult = await Result.tryPromise({
      try: () => stepWrite(writes, input.teamId),
      catch: (cause) =>
         new ClassifyBatchWorkflowError({
            error: classifyBatchWorkflowErrors.WRITE_FAILED({
               internal: { cause: serializeUnknownCause(cause) },
            }),
            message: "Falha ao gravar classificações.",
            batchId,
            teamId: input.teamId,
            organizationId: input.organizationId,
         }),
   });
   if (Result.isError(writeResult)) throw writeResult.error;

   DBOS.logger.info(
      `${log} completed — ai=${aiResults.length} written=${writes.length}`,
   );
}

export const classifyTransactionsBatchWorkflow = registerWorkflowOnce(
   classifyTransactionsBatchWorkflowFn,
   { name: CLASSIFICATION_WORKFLOWS.classifyTransactionsBatch },
);
