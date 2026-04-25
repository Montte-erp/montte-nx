import { err, fromPromise, ok, safeTry } from "neverthrow";
import { chat } from "@tanstack/ai";
import { z } from "zod";
import { AppError } from "@core/logging/errors";
import { promptsClient } from "@core/posthog/server";
import { POSTHOG_PROMPTS } from "@core/posthog/config";
import { flashModel } from "@core/ai/models";
import { createPosthogAiMiddleware } from "@core/ai/middleware";
import type { AiObservabilityContext } from "@core/ai/observability";

export const classifyOptionSchema = z.object({
   id: z.string(),
   name: z.string(),
   keywords: z.array(z.string()).nullish(),
});

export const classifyInputSchema = z.object({
   name: z.string(),
   type: z.enum(["income", "expense"]),
   contactName: z.string().nullish(),
});

export const classifyResultSchema = z.object({
   categoryId: z.string(),
   tagId: z.string().nullable(),
});

export type ClassifyOption = z.infer<typeof classifyOptionSchema>;
export type ClassifyInput = z.infer<typeof classifyInputSchema>;
export type ClassifyResult = z.infer<typeof classifyResultSchema>;

const outputSchema = z.object({
   categoryName: z.string().nullable(),
   tagName: z.string().nullable(),
});

function formatList(items: ClassifyOption[]) {
   return items
      .map(
         (i) =>
            `- ${i.name}${i.keywords?.length ? ` (palavras: ${i.keywords.join(", ")})` : ""}`,
      )
      .join("\n");
}

export function classifyTransaction(
   input: ClassifyInput,
   categories: ClassifyOption[],
   tags: ClassifyOption[],
   observability: AiObservabilityContext,
) {
   const userContent = [
      `Nome: ${input.name}`,
      `Tipo: ${input.type === "income" ? "Receita" : "Despesa"}`,
      ...(input.contactName ? [`Contato: ${input.contactName}`] : []),
   ].join("\n");

   return safeTry(async function* () {
      const { prompt, name, version } = yield* fromPromise(
         promptsClient.get(POSTHOG_PROMPTS.classifyTransaction, {
            withMetadata: true,
         }),
         (e) =>
            AppError.internal("Falha na classificação por IA.", { cause: e }),
      );

      const result = yield* fromPromise(
         chat({
            adapter: flashModel,
            systemPrompts: [
               promptsClient.compile(prompt, {
                  category_list: formatList(categories),
                  tag_list: formatList(tags),
                  type: input.type,
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
            AppError.internal("Falha na classificação por IA.", { cause: e }),
      );

      if (!result.categoryName)
         return err(AppError.notFound("Nenhuma categoria sugerida pela IA."));

      const categoryMatch = categories.find(
         (c) => c.name === result.categoryName,
      );
      if (!categoryMatch)
         return err(AppError.notFound("Categoria sugerida não encontrada."));

      const tagMatch = result.tagName
         ? (tags.find((t) => t.name === result.tagName) ?? null)
         : null;

      return ok({ categoryId: categoryMatch.id, tagId: tagMatch?.id ?? null });
   });
}
