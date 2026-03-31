import {
   type CustomRequestContext,
   createRequestContext,
   mastra,
} from "@core/agents";
import {
   AVAILABLE_MODELS,
   DEFAULT_CONTENT_MODEL_ID,
   type ModelId,
   getModelPreset,
} from "@core/agents/models";
import { emitAiChatMessage } from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { z } from "zod";
import { protectedProcedure } from "../server";

type ChatChunk =
   | { type: "text"; text: string }
   | {
        type: "tool_call_start";
        toolCall: { id: string; name: string; args: unknown };
     }
   | {
        type: "tool_call_complete";
        toolCallId: string;
        toolName: string;
        result: unknown;
     }
   | { type: "step_start"; stepIndex: number }
   | { type: "step_complete"; stepIndex: number }
   | { type: "done" }
   | { type: "error"; error: string };

export const aiCommandStream = protectedProcedure
   .input(
      z.object({
         prompt: z.string(),
         model: z.string().optional(),
         language: z.string().optional(),
      }),
   )
   .handler(async function* ({ context, input }) {
      const { userId, db, organizationId, posthog, teamId, headers } = context;

      const agent = mastra.getAgent("rubiAgent");

      const modelId = (input.model ?? DEFAULT_CONTENT_MODEL_ID) as ModelId;
      const preset = getModelPreset(
         AVAILABLE_MODELS,
         modelId,
         DEFAULT_CONTENT_MODEL_ID,
      );

      const requestContext = createRequestContext({
         userId,
         language: input.language ?? getRequestLanguage(headers) ?? "pt-BR",
         model: modelId,
         temperature: preset.temperature,
         topP: preset.topP,
         maxTokens: preset.maxTokens,
         frequencyPenalty: preset.frequencyPenalty,
         presencePenalty: preset.presencePenalty,
      } as CustomRequestContext);

      let stepIndex = 0;
      const startTime = Date.now();

      try {
         const result = await agent.stream(
            [{ role: "user", content: input.prompt }],
            { requestContext },
         );

         for await (const event of result.fullStream) {
            switch (event.type) {
               case "text-delta": {
                  const textDelta = event.payload.text;
                  if (!textDelta) break;
                  yield {
                     type: "text",
                     text: textDelta,
                  } satisfies ChatChunk;
                  break;
               }

               case "tool-call": {
                  const { toolCallId, toolName, args } = event.payload;
                  if (!toolCallId || !toolName || !args) break;

                  yield {
                     type: "tool_call_start",
                     toolCall: {
                        id: toolCallId,
                        name: toolName,
                        args,
                     },
                  } satisfies ChatChunk;
                  break;
               }

               case "tool-result": {
                  const { toolCallId, toolName, result: resultValue } =
                     event.payload;
                  if (!toolCallId || !toolName) break;

                  yield {
                     type: "tool_call_complete",
                     toolCallId,
                     toolName,
                     result: resultValue,
                  } satisfies ChatChunk;
                  break;
               }

               case "step-start":
                  yield {
                     type: "step_start",
                     stepIndex,
                  } satisfies ChatChunk;
                  break;

               case "step-finish":
                  yield {
                     type: "step_complete",
                     stepIndex,
                  } satisfies ChatChunk;
                  stepIndex++;
                  break;
            }
         }

         const latencyMs = Date.now() - startTime;

         try {
            await emitAiChatMessage(
               createEmitFn(db, posthog),
               { organizationId, userId, teamId },
               {
                  chatId: crypto.randomUUID(),
                  model: modelId,
                  provider: "openrouter",
                  role: "assistant",
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                  latencyMs,
               },
            );
         } catch {}

         yield {
            type: "done",
         } satisfies ChatChunk;
      } catch (error) {
         yield {
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
         } satisfies ChatChunk;
      }
   });

function getRequestLanguage(headers: Headers): string | undefined {
   const raw = headers.get("accept-language");
   if (!raw) return undefined;
   const [primary] = raw.split(",");
   return primary?.trim() || undefined;
}
