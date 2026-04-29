import { errAsync, fromPromise } from "neverthrow";
import { chat } from "@tanstack/ai";
import { z } from "zod";
import { AppError } from "@core/logging/errors";
import type { Prompts } from "@core/posthog/server";
import { CLASSIFICATION_PROMPTS } from "../constants";
import { flashModel } from "@core/ai/models";
import {
   type AiObservabilityContext,
   createPosthogAiMiddleware,
} from "@core/ai/middleware";

const MAX_BATCH_SIZE = 20;

export const classifyBatchInputSchema = z.object({
   id: z.string(),
   name: z.string(),
   type: z.enum(["income", "expense"]),
   contactName: z.string().nullish(),
});

export const classifyBatchOptionSchema = z.object({
   id: z.string(),
   name: z.string(),
   keywords: z.array(z.string()).nullish(),
});

export const classifyBatchResultSchema = z.object({
   transactionId: z.string(),
   categoryId: z.string(),
});

export type ClassifyBatchInput = z.infer<typeof classifyBatchInputSchema>;
export type ClassifyBatchOption = z.infer<typeof classifyBatchOptionSchema>;
export type ClassifyBatchResult = z.infer<typeof classifyBatchResultSchema>;

const outputSchema = z.object({
   results: z.array(
      z.object({
         id: z.string(),
         categoryName: z.string().nullable(),
      }),
   ),
});

const aiError = (cause: unknown) =>
   AppError.internal("Falha na classificação por IA em lote.", { cause });

function formatCategory(c: ClassifyBatchOption) {
   const keywords = c.keywords?.length
      ? ` (palavras: ${c.keywords.join(", ")})`
      : "";
   return `- ${c.name}${keywords}`;
}

function formatTransaction(tx: ClassifyBatchInput) {
   const parts = [
      `[id=${tx.id}]`,
      `Nome: ${tx.name}`,
      `Tipo: ${tx.type === "income" ? "Receita" : "Despesa"}`,
   ];
   if (tx.contactName) parts.push(`Contato: ${tx.contactName}`);
   return parts.join("\n");
}

function resolveResults(
   raw: { id: string; categoryName: string | null }[],
   transactions: ClassifyBatchInput[],
   categories: ClassifyBatchOption[],
): ClassifyBatchResult[] {
   const inputIds = new Set(transactions.map((tx) => tx.id));
   const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

   return raw.flatMap((entry) => {
      if (!inputIds.has(entry.id) || !entry.categoryName) return [];
      const categoryId = categoryByName.get(entry.categoryName);
      if (!categoryId) return [];
      return [{ transactionId: entry.id, categoryId }];
   });
}

export function classifyTransactionsBatch(
   prompts: Prompts,
   transactions: ClassifyBatchInput[],
   categories: ClassifyBatchOption[],
   observability: AiObservabilityContext,
) {
   if (transactions.length > MAX_BATCH_SIZE) {
      return errAsync(
         AppError.internal("Batch maior que 20 — chunk antes de chamar."),
      );
   }

   return fromPromise(
      prompts.get(CLASSIFICATION_PROMPTS.classifyTransaction, {
         withMetadata: true,
      }),
      aiError,
   )
      .andThen(({ prompt, name, version }) =>
         fromPromise(
            chat({
               adapter: flashModel,
               systemPrompts: [
                  prompts.compile(prompt, {
                     category_list: categories.map(formatCategory).join("\n"),
                  }),
               ],
               messages: [
                  {
                     role: "user",
                     content: [
                        {
                           type: "text",
                           content: transactions
                              .map(formatTransaction)
                              .join("\n\n"),
                        },
                     ],
                  },
               ],
               outputSchema,
               stream: false,
               middleware: [
                  createPosthogAiMiddleware({
                     ...observability,
                     promptName: name,
                     promptVersion: version,
                  }),
               ],
            }),
            aiError,
         ),
      )
      .map((response) =>
         resolveResults(response.results, transactions, categories),
      );
}
