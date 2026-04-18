import { fromPromise, ok, err, safeTry } from "neverthrow";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import { AppError } from "@core/logging/errors";
import { promptsClient } from "@core/posthog/server";
import { POSTHOG_PROMPTS } from "@core/posthog/config";
import {
   createPosthogAiMiddleware,
   type AiObservabilityContext,
} from "../middleware/posthog";

type OpenRouterModelId = Parameters<typeof openRouterText>[0];

export const categoryOptionSchema = z.object({
   id: z.string(),
   name: z.string(),
   keywords: z.array(z.string()).nullish(),
});

export const inferCategoryInputSchema = z.object({
   name: z.string(),
   type: z.enum(["income", "expense"]),
   contactName: z.string().nullish(),
});

export const inferCategoryResultSchema = z.object({
   categoryId: z.string(),
});

export type CategoryOption = z.infer<typeof categoryOptionSchema>;
export type InferCategoryInput = z.infer<typeof inferCategoryInputSchema>;
export type InferCategoryResult = z.infer<typeof inferCategoryResultSchema>;

const outputSchema = z.object({
   categoryName: z.string().nullable(),
});

export function inferCategoryWithAI(
   cats: CategoryOption[],
   input: InferCategoryInput,
   model: OpenRouterModelId,
   observability: AiObservabilityContext,
) {
   const categoryList = cats
      .map(
         (c) =>
            `- ${c.name}${c.keywords?.length ? ` (palavras: ${c.keywords.join(", ")})` : ""}`,
      )
      .join("\n");

   const userContent = [
      `Nome: ${input.name}`,
      `Tipo: ${input.type === "income" ? "Receita" : "Despesa"}`,
      ...(input.contactName ? [`Contato: ${input.contactName}`] : []),
   ].join("\n");

   return safeTry(async function* () {
      const { prompt, name, version } = yield* fromPromise(
         promptsClient.get(POSTHOG_PROMPTS.categorizeTransaction, {
            withMetadata: true,
         }),
         (e) =>
            AppError.internal("Falha na inferência de categoria por IA.", {
               cause: e,
            }),
      );

      const result = yield* fromPromise(
         chat({
            adapter: openRouterText(model),
            systemPrompts: [
               promptsClient.compile(prompt, { category_list: categoryList }),
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
            AppError.internal("Falha na inferência de categoria por IA.", {
               cause: e,
            }),
      );

      if (!result.categoryName)
         return err(AppError.notFound("Nenhuma categoria sugerida pela IA."));
      const match = cats.find((c) => c.name === result.categoryName);
      if (!match)
         return err(AppError.notFound("Categoria sugerida não encontrada."));
      return ok({ categoryId: match.id });
   });
}
