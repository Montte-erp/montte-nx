import { err, fromPromise, ok, safeTry } from "neverthrow";
import { chat } from "@tanstack/ai";
import { z } from "zod";
import { AppError } from "@core/logging/errors";
import { promptsClient } from "@core/posthog/server";
import { POSTHOG_PROMPTS } from "@core/posthog/config";
import { flashModel } from "@core/ai/models";
import { createPosthogAiMiddleware } from "@core/ai/middleware";
import type { AiObservabilityContext } from "@core/ai/observability";

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
   tagId: z.string().nullable(),
});

export type ClassifyBatchInput = z.infer<typeof classifyBatchInputSchema>;
export type ClassifyBatchOption = z.infer<typeof classifyBatchOptionSchema>;
export type ClassifyBatchResult = z.infer<typeof classifyBatchResultSchema>;

const outputSchema = z.object({
   results: z.array(
      z.object({
         id: z.string(),
         categoryName: z.string().nullable(),
         tagName: z.string().nullable(),
      }),
   ),
});

function formatList(items: ClassifyBatchOption[]) {
   return items
      .map(
         (i) =>
            `- ${i.name}${i.keywords?.length ? ` (palavras: ${i.keywords.join(", ")})` : ""}`,
      )
      .join("\n");
}

function formatTransaction(tx: ClassifyBatchInput) {
   return [
      `[id=${tx.id}]`,
      `Nome: ${tx.name}`,
      `Tipo: ${tx.type === "income" ? "Receita" : "Despesa"}`,
      ...(tx.contactName ? [`Contato: ${tx.contactName}`] : []),
   ].join("\n");
}

export function classifyTransactionsBatch(
   transactions: ClassifyBatchInput[],
   categories: ClassifyBatchOption[],
   tags: ClassifyBatchOption[],
   observability: AiObservabilityContext,
) {
   return safeTry(async function* () {
      if (transactions.length > MAX_BATCH_SIZE) {
         return err(
            AppError.internal("Batch maior que 20 — chunk antes de chamar."),
         );
      }

      const { prompt, name, version } = yield* fromPromise(
         promptsClient.get(POSTHOG_PROMPTS.classifyTransaction, {
            withMetadata: true,
         }),
         (e) =>
            AppError.internal("Falha na classificação por IA em lote.", {
               cause: e,
            }),
      );

      const userContent = transactions.map(formatTransaction).join("\n\n");

      const result = yield* fromPromise(
         chat({
            adapter: flashModel,
            systemPrompts: [
               promptsClient.compile(prompt, {
                  category_list: formatList(categories),
                  tag_list: formatList(tags),
                  transactions: JSON.stringify(
                     transactions.map((tx) => ({
                        id: tx.id,
                        name: tx.name,
                        type: tx.type,
                        contactName: tx.contactName ?? null,
                     })),
                  ),
               }),
            ],
            messages: [
               {
                  role: "user",
                  content: [{ type: "text", content: userContent }],
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
         (e) =>
            AppError.internal("Falha na classificação por IA em lote.", {
               cause: e,
            }),
      );

      const inputIds = new Set(transactions.map((tx) => tx.id));
      const resolved: ClassifyBatchResult[] = [];

      for (const entry of result.results) {
         if (!inputIds.has(entry.id)) continue;
         if (!entry.categoryName) continue;

         const categoryMatch = categories.find(
            (c) => c.name === entry.categoryName,
         );
         if (!categoryMatch) continue;

         const tagMatch = entry.tagName
            ? (tags.find((t) => t.name === entry.tagName) ?? null)
            : null;

         resolved.push({
            transactionId: entry.id,
            categoryId: categoryMatch.id,
            tagId: tagMatch?.id ?? null,
         });
      }

      return ok(resolved);
   });
}
