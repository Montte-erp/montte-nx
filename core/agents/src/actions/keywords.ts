import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";

type OpenRouterModelId = Parameters<typeof openRouterText>[0];

const outputSchema = z.object({
   keywords: z
      .array(z.string().min(1).max(60))
      .min(1)
      .max(20)
      .describe(
         "Lista de palavras-chave financeiras para categorização de transações",
      ),
});

export type DeriveKeywordsAIInput = {
   name: string;
   description?: string | null;
   model: OpenRouterModelId;
};

export async function deriveKeywordsWithAI(
   input: DeriveKeywordsAIInput,
): Promise<string[]> {
   const result = await chat({
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
   });
   return result.keywords;
}
