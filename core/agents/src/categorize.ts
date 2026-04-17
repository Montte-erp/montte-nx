import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";

type CategoryOption = {
   id: string;
   name: string;
   keywords?: string[] | null;
};

const outputSchema = z.object({
   categoryName: z.string().nullable(),
   confidence: z.enum(["high", "low"]),
});

export type InferCategoryInput = {
   name: string;
   type: "income" | "expense";
   contactName?: string | null;
};

export type InferCategoryResult = {
   categoryId: string;
   confidence: "high" | "low";
};

export async function inferCategoryWithAI(
   cats: CategoryOption[],
   input: InferCategoryInput,
   model: string,
): Promise<InferCategoryResult | null> {
   const categoryList = cats
      .map(
         (c) =>
            `- ${c.name}${c.keywords?.length ? ` (palavras: ${c.keywords.join(", ")})` : ""}`,
      )
      .join("\n");

   const prompt = `Você é um assistente financeiro brasileiro. Classifique a transação abaixo na categoria mais adequada.

Transação:
- Nome: ${input.name}${input.contactName ? `\n- Contato: ${input.contactName}` : ""}
- Tipo: ${input.type === "income" ? "Receita" : "Despesa"}

Categorias disponíveis:
${categoryList}

Retorne o nome exato de uma categoria da lista acima, ou null se nenhuma for adequada.
Se tiver certeza, retorne confidence "high". Se estiver em dúvida, retorne "low".`;

   const result = await chat({
      adapter: openRouterText(model),
      messages: [
         { role: "user", content: [{ type: "text", content: prompt }] },
      ],
      outputSchema,
      stream: false,
   });

   if (!result.categoryName) return null;

   const match = cats.find((c) => c.name === result.categoryName);
   if (!match) return null;

   return { categoryId: match.id, confidence: result.confidence };
}
