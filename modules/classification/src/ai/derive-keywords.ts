import { fromPromise, ok, safeTry } from "neverthrow";
import { chat } from "@tanstack/ai";
import { z } from "zod";
import { AppError } from "@core/logging/errors";
import { promptsClient } from "@core/posthog/server";
import { POSTHOG_PROMPTS } from "@core/posthog/config";
import { proModel } from "@core/ai/models";
import { createPosthogAiMiddleware } from "@core/ai/middleware";
import type { AiObservabilityContext } from "@core/ai/observability";

const KEYWORDS_MIN = 5;
const KEYWORDS_MAX = 15;

export const deriveKeywordsInputSchema = z.object({
   entity: z.enum(["category", "tag"]),
   name: z.string(),
   description: z.string().nullish(),
});

export type DeriveKeywordsInput = z.infer<typeof deriveKeywordsInputSchema>;

const outputSchema = z.object({
   keywords: z
      .array(z.string().min(1).max(60))
      .min(KEYWORDS_MIN)
      .max(KEYWORDS_MAX),
});

const ENTITY_LABEL: Record<DeriveKeywordsInput["entity"], string> = {
   category: "categoria financeira",
   tag: "centro de custo",
};

export function deriveKeywords(
   input: DeriveKeywordsInput,
   observability: AiObservabilityContext,
) {
   const userContent = [
      `${ENTITY_LABEL[input.entity]}: ${input.name}`,
      ...(input.description ? [`Descrição: ${input.description}`] : []),
   ].join("\n");

   return safeTry(async function* () {
      const { prompt, name, version } = yield* fromPromise(
         promptsClient.get(POSTHOG_PROMPTS.deriveKeywords, {
            withMetadata: true,
         }),
         (e) =>
            AppError.internal("Falha na derivação de palavras-chave por IA.", {
               cause: e,
            }),
      );

      const result = yield* fromPromise(
         chat({
            adapter: proModel,
            systemPrompts: [
               promptsClient.compile(prompt, {
                  entity_label: ENTITY_LABEL[input.entity],
                  min_keywords: KEYWORDS_MIN,
                  max_keywords: KEYWORDS_MAX,
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
            AppError.internal("Falha na derivação de palavras-chave por IA.", {
               cause: e,
            }),
      );

      return ok(result.keywords);
   });
}
