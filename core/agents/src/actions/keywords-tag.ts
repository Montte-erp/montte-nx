import { fromPromise, ok, safeTry } from "neverthrow";
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

export const deriveTagKeywordsAIInputSchema = z.object({
   name: z.string(),
   description: z.string().nullish(),
   model: z.custom<OpenRouterModelId>(),
});

export type DeriveTagKeywordsAIInput = z.infer<
   typeof deriveTagKeywordsAIInputSchema
>;

const KEYWORDS_MIN = 5;
const KEYWORDS_MAX = 15;

const keywordsSchema = z
   .array(z.string().min(1).max(60))
   .min(KEYWORDS_MIN)
   .max(KEYWORDS_MAX);

const outputSchema = z.object({
   keywords: keywordsSchema.describe(
      "Lista de palavras-chave financeiras para categorização de transações por centro de custo",
   ),
});

export function deriveTagKeywordsWithAI(
   input: DeriveTagKeywordsAIInput,
   observability: AiObservabilityContext,
) {
   const userContent = [
      `Centro de Custo: ${input.name}`,
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

      return ok(
         yield* fromPromise(
            chat({
               adapter: openRouterText(input.model),
               systemPrompts: [
                  promptsClient.compile(prompt, {
                     entity_label: "centro de custo",
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
            }).then((result) => result.keywords),
            (e) =>
               AppError.internal(
                  "Falha na derivação de palavras-chave por IA.",
                  { cause: e },
               ),
         ),
      );
   });
}
