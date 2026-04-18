import { fromPromise } from "neverthrow";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import { AppError } from "@core/logging/errors";
import { compileSystemPrompt } from "@core/posthog/prompts";

type OpenRouterModelId = Parameters<typeof openRouterText>[0];

export type TagOption = {
   id: string;
   name: string;
   description?: string | null;
};

const outputSchema = z.object({
   tagName: z.string().nullable(),
   confidence: z.enum(["high", "low"]),
});

export function inferTagWithAI(
   tagOptions: TagOption[],
   transactionName: string,
   model: OpenRouterModelId,
) {
   const tagList = tagOptions
      .map((t) => `- ${t.name}${t.description ? ` (${t.description})` : ""}`)
      .join("\n");

   return compileSystemPrompt("suggestTag", { tag_list: tagList })
      .mapErr((e) =>
         AppError.internal("Falha na inferência de centro de custo por IA.", {
            cause: e,
         }),
      )
      .andThen((systemPrompt) =>
         fromPromise(
            chat({
               adapter: openRouterText(model),
               systemPrompts: [systemPrompt],
               messages: [
                  {
                     role: "user",
                     content: [{ type: "text", content: transactionName }],
                  },
               ],
               outputSchema,
               stream: false,
            }).then(
               (
                  result,
               ): { tagId: string; confidence: "high" | "low" } | null => {
                  if (!result.tagName) return null;
                  const match = tagOptions.find(
                     (t) => t.name === result.tagName,
                  );
                  if (!match) return null;
                  return { tagId: match.id, confidence: result.confidence };
               },
            ),
            (e) =>
               AppError.internal(
                  "Falha na inferência de centro de custo por IA.",
                  { cause: e },
               ),
         ),
      );
}
