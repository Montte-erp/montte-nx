import { fromPromise } from "neverthrow";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import { AppError } from "@core/logging/errors";

type OpenRouterModelId = Parameters<typeof openRouterText>[0];

export const deriveKeywordsAIInputSchema = z.object({
   name: z.string(),
   description: z.string().nullish(),
   model: z.custom<OpenRouterModelId>(),
});

export type DeriveKeywordsAIInput = z.infer<typeof deriveKeywordsAIInputSchema>;

const outputSchema = z.object({
   keywords: z
      .array(z.string().min(1).max(60))
      .min(1)
      .max(20)
      .describe(
         "Lista de palavras-chave financeiras para categorização de transações",
      ),
});

export function deriveKeywordsWithAI(input: DeriveKeywordsAIInput) {
   return fromPromise(
      chat({
         adapter: openRouterText(input.model),
         messages: [
            {
               role: "user",
               content: [
                  {
                     type: "text",
                     content: `Você é um assistente financeiro brasileiro. Gere palavras-chave para a categoria financeira abaixo. As palavras-chave devem ser termos comuns que aparecem em descrições de transações bancárias.

Categoria: ${input.name}${input.description ? `\nDescrição: ${input.description}` : ""}

Retorne entre 5 e 15 palavras-chave relevantes em português brasileiro. Inclua variações, abreviações e termos relacionados.`,
                  },
               ],
            },
         ],
         outputSchema,
         stream: false,
      }).then((result) => result.keywords),
      (e) => AppError.internal("AI keyword derivation failed", { cause: e }),
   );
}
