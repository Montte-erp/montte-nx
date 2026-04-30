import { fromPromise } from "neverthrow";
import { chat } from "@tanstack/ai";
import { z } from "zod";
import { categorySchema } from "@core/database/schemas/categories";
import { AppError } from "@core/logging/errors";
import type { Prompts } from "@core/posthog/server";
import { CLASSIFICATION_PROMPTS } from "@modules/classification/constants";
import { proModel } from "@core/ai/models";
import {
   type AiObservabilityContext,
   createPosthogAiMiddleware,
} from "@core/ai/middleware";

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

const aiError = (cause: unknown) =>
   AppError.internal("Falha na derivação de palavras-chave por IA.", { cause });

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
   observability: AiObservabilityContext,
) {
   return fromPromise(
      prompts.get(CLASSIFICATION_PROMPTS.deriveKeywords, {
         withMetadata: true,
      }),
      aiError,
   )
      .andThen(({ prompt, name, version }) =>
         fromPromise(
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
                        { type: "text", content: buildUserMessage(input) },
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
      .map((result) => result.keywords);
}
