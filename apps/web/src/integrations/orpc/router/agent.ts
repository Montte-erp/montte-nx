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
import { agentSettings } from "@core/database/schemas/agents";
import {
   getAgentSettings,
   upsertAgentSettings,
} from "@core/database/repositories/agent-settings-repository";
import { emitAiChatMessage } from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

const agentSettingsSchema = createInsertSchema(agentSettings).omit({
   teamId: true,
   createdAt: true,
   updatedAt: true,
});

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

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   return getAgentSettings(context.db, context.teamId);
});

export const upsertSettings = protectedProcedure
   .input(agentSettingsSchema.partial())
   .handler(async ({ context, input }) => {
      return upsertAgentSettings(context.db, context.teamId, input);
   });
