import { fromPromise } from "neverthrow";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import { AppError } from "@core/logging/errors";
import { compileSystemPrompt } from "@core/posthog/prompts";

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
   confidence: z.enum(["high", "low"]),
});

export type CategoryOption = z.infer<typeof categoryOptionSchema>;
export type InferCategoryInput = z.infer<typeof inferCategoryInputSchema>;
export type InferCategoryResult = z.infer<typeof inferCategoryResultSchema>;

const outputSchema = z.object({
   categoryName: z.string().nullable(),
   confidence: z.enum(["high", "low"]),
});

export function inferCategoryWithAI(
   cats: CategoryOption[],
   input: InferCategoryInput,
   model: OpenRouterModelId,
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

   return compileSystemPrompt("categorizeTransaction", {
      category_list: categoryList,
   })
      .mapErr((e) =>
         AppError.internal("AI category inference failed", { cause: e }),
      )
      .andThen((systemPrompt) =>
         fromPromise(
            chat({
               adapter: openRouterText(model),
               systemPrompts: [systemPrompt],
               messages: [
                  {
                     role: "user",
                     content: [{ type: "text", content: userContent }],
                  },
               ],
               outputSchema,
               stream: false,
            }).then((result): InferCategoryResult | null => {
               if (!result.categoryName) return null;
               const match = cats.find((c) => c.name === result.categoryName);
               if (!match) return null;
               return { categoryId: match.id, confidence: result.confidence };
            }),
            (e) =>
               AppError.internal("AI category inference failed", { cause: e }),
         ),
      );
}
