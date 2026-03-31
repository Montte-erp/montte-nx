import {
   type CustomRequestContext,
   createRequestContext,
   mastra,
   type RequestContext,
} from "@core/agents";
import {
   AVAILABLE_MODELS,
   DEFAULT_CONTENT_MODEL_ID,
   type ModelId,
   getModelPreset,
} from "@core/agents/models";
import { emitAiChatMessage } from "@packages/events/ai";
import { enforceCreditBudget } from "@packages/events/credits";
import { createEmitFn } from "@packages/events/emit";
import { WebAppError } from "@core/logging/errors";
import { z } from "zod";
import { protectedProcedure } from "../server";

type ChatChunk =
   | { type: "text"; text: string }
   | {
        type: "tool_call_start";
        toolCall: { id: string; name: string; args: Record<string, unknown> };
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
      const { userId, db, organizationId, posthog, teamId, headers, redis } = context;

      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
         columns: { stripeCustomerId: true },
      });

      try {
         await enforceCreditBudget(organizationId, "ai.chat_message", redis, userRecord?.stripeCustomerId);
      } catch {
         throw WebAppError.forbidden("Limite gratuito de mensagens de IA atingido. Adicione um método de pagamento para continuar.");
      }

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
            {
               requestContext: requestContext as RequestContext<unknown>,
            } as unknown as Parameters<typeof agent.stream>[1],
         );

         for await (const event of result.fullStream) {
            const chunk = event as unknown as {
               type: string;
               payload?: {
                  textDelta?: string;
                  toolCallId?: string;
                  toolName?: string;
                  args?: Record<string, unknown>;
                  result?: unknown;
               };
               textDelta?: string;
               toolCallId?: string;
               toolName?: string;
               args?: Record<string, unknown>;
               result?: unknown;
            };

            switch (chunk.type) {
               case "text-delta": {
                  const payload = chunk.payload as unknown as {
                     textDelta?: string;
                  };
                  const textDelta = chunk.textDelta ?? payload?.textDelta;
                  if (!textDelta) break;
                  yield {
                     type: "text",
                     text: textDelta,
                  } satisfies ChatChunk;
                  break;
               }

               case "tool-call": {
                  const toolCallId =
                     chunk.toolCallId ?? chunk.payload?.toolCallId;
                  const toolName = chunk.toolName ?? chunk.payload?.toolName;
                  const args = chunk.args ?? chunk.payload?.args;
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
                  const toolCallId =
                     chunk.toolCallId ?? chunk.payload?.toolCallId;
                  const toolName = chunk.toolName ?? chunk.payload?.toolName;
                  const resultValue = chunk.result ?? chunk.payload?.result;
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
               createEmitFn(db, posthog, userRecord?.stripeCustomerId ? context.stripeClient : undefined, userRecord?.stripeCustomerId ?? undefined, redis),
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
