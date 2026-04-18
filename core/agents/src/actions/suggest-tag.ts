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

export const tagOptionSchema = z.object({
   id: z.string(),
   name: z.string(),
   description: z.string().nullish(),
});

export type TagOption = z.infer<typeof tagOptionSchema>;

const outputSchema = z.object({
   tagName: z.string().nullable(),
});

export function inferTagWithAI(
   tagOptions: TagOption[],
   transactionName: string,
   model: OpenRouterModelId,
   observability: AiObservabilityContext,
) {
   const tagList = tagOptions
      .map((t) => `- ${t.name}${t.description ? ` (${t.description})` : ""}`)
      .join("\n");

   return safeTry(async function* () {
      const { prompt, name, version } = yield* fromPromise(
         promptsClient.get(POSTHOG_PROMPTS.suggestTag, { withMetadata: true }),
         (e) =>
            AppError.internal(
               "Falha na inferência de centro de custo por IA.",
               { cause: e },
            ),
      );

      const result = yield* fromPromise(
         chat({
            adapter: openRouterText(model),
            systemPrompts: [
               promptsClient.compile(prompt, { tag_list: tagList }),
            ],
            messages: [
               {
                  role: "user",
                  content: [{ type: "text", content: transactionName }],
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
            AppError.internal(
               "Falha na inferência de centro de custo por IA.",
               { cause: e },
            ),
      );

      if (!result.tagName)
         return err(
            AppError.notFound("Nenhum centro de custo sugerido pela IA."),
         );
      const match = tagOptions.find((t) => t.name === result.tagName);
      if (!match)
         return err(
            AppError.notFound("Centro de custo sugerido não encontrado."),
         );
      return ok(match.id);
   });
}
