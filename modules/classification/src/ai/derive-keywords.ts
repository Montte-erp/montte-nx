import { chat } from "@tanstack/ai";
import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import { categorySchema } from "@core/database/schemas/categories";
import type { Prompts } from "@core/posthog/server";
import { CLASSIFICATION_PROMPTS } from "@modules/classification/constants";
import { proModel } from "@core/ai/models";
import { aiTraceAttributes, type AiTraceContext } from "@core/ai/otel";
import { getAiTracer } from "@core/logging";

const KEYWORDS_MIN = 5;
const KEYWORDS_MAX = 15;

export const deriveKeywordsInputSchema = categorySchema
   .pick({ name: true, description: true })
   .extend({ siblingKeywords: z.array(z.string()).optional() });

export type DeriveKeywordsInput = z.infer<typeof deriveKeywordsInputSchema>;

const outputSchema = z.object({
   keywords: z
      .array(z.string().min(1).max(60))
      .min(KEYWORDS_MIN)
      .max(KEYWORDS_MAX),
});

const deriveKeywordsErrors = defineErrorCatalog("classification.ai.keywords", {
   PROMPT_LOAD_FAILED: {
      status: 500,
      message: "Falha ao carregar prompt de palavras-chave.",
      tags: ["classification", "ai", "keywords"],
   },
   AI_FAILED: {
      status: 500,
      message: "Falha na derivação de palavras-chave por IA.",
      tags: ["classification", "ai", "keywords"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "classification.ai.keywords": typeof deriveKeywordsErrors;
   }
}

type DeriveKeywordsCatalogError =
   | ReturnType<typeof deriveKeywordsErrors.PROMPT_LOAD_FAILED>
   | ReturnType<typeof deriveKeywordsErrors.AI_FAILED>;

export class DeriveKeywordsError extends TaggedError("DeriveKeywordsError")<{
   error: DeriveKeywordsCatalogError;
}>() {}

function buildUserMessage(input: DeriveKeywordsInput): string {
   const lines = [`Categoria: ${input.name}`];
   if (input.description) lines.push(`Descrição: ${input.description}`);
   if (input.siblingKeywords?.length) {
      lines.push(
         `Palavras-chave já usadas por outras categorias do time (NÃO repetir): ${input.siblingKeywords.join(", ")}`,
      );
   }
   return lines.join("\n");
}

export function deriveKeywords(
   prompts: Prompts,
   input: DeriveKeywordsInput,
   observability: AiTraceContext,
) {
   return Result.gen(async function* () {
      const { prompt, name, version } = yield* Result.await(
         Result.tryPromise({
            try: () =>
               prompts.get(CLASSIFICATION_PROMPTS.deriveKeywords, {
                  withMetadata: true,
               }),
            catch: () =>
               new DeriveKeywordsError({
                  error: deriveKeywordsErrors.PROMPT_LOAD_FAILED(),
               }),
         }),
      );

      const result = yield* Result.await(
         Result.tryPromise({
            try: () =>
               chat({
                  adapter: proModel,
                  systemPrompts: [
                     prompts.compile(prompt, {
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
                              content: buildUserMessage(input),
                           },
                        ],
                     },
                  ],
                  outputSchema,
                  stream: false,
                  middleware: [
                     otelMiddleware({
                        tracer: getAiTracer(),
                        captureContent: false,
                        attributeEnricher: () =>
                           aiTraceAttributes({
                              ...observability,
                              promptName: name,
                              promptVersion: version,
                           }),
                     }),
                  ],
               }),
            catch: () =>
               new DeriveKeywordsError({
                  error: deriveKeywordsErrors.AI_FAILED(),
               }),
         }),
      );

      return Result.ok(result.keywords);
   });
}
