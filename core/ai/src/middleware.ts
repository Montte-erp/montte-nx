import { fromThrowable } from "neverthrow";
import { z } from "zod";
import type { PostHog } from "@core/posthog/server";
import type {
   AfterToolCallInfo,
   ChatMiddleware,
   ChatMiddlewareContext,
   StreamChunk,
} from "@tanstack/ai";

const observabilityContextSchema = z.object({
   posthog: z.custom<PostHog>(),
   distinctId: z.string(),
   promptName: z.string().optional(),
   promptVersion: z.number().optional(),
   customProperties: z.record(z.string(), z.unknown()).optional(),
});

const toolCallSummarySchema = z.object({
   id: z.string(),
   name: z.string(),
   ok: z.boolean(),
   durationMs: z.number(),
   error: z.string().optional(),
});

const errorWithMessageSchema = z.object({ message: z.string() });

const generationOptionsSchema = z.object({
   temperature: z.number().optional(),
   maxTokens: z.number().optional(),
   topP: z.number().optional(),
});

export type AiObservabilityContext = z.infer<typeof observabilityContextSchema>;
type ToolCallSummary = z.infer<typeof toolCallSummarySchema>;

function toMessage(error: unknown): string {
   return (
      errorWithMessageSchema.safeParse(error).data?.message ?? String(error)
   );
}

function toolsSpec(toolNames?: ReadonlyArray<string>) {
   return toolNames?.length
      ? toolNames.map((name) => ({
           type: "function" as const,
           function: { name, parameters: {} },
        }))
      : undefined;
}

export function createPosthogAiMiddleware(
   obs: AiObservabilityContext,
): ChatMiddleware {
   const toolCalls: ToolCallSummary[] = [];
   const safeCapture = fromThrowable(obs.posthog.capture.bind(obs.posthog));

   let startTime = 0;
   let firstTokenTime = 0;

   const baseProps = (ctx: ChatMiddlewareContext) => {
      const opts = generationOptionsSchema.safeParse(ctx.options).data ?? {};
      return {
         $ai_trace_id: ctx.requestId,
         $ai_span_id: ctx.streamId,
         $ai_model: ctx.model,
         $ai_provider: ctx.provider,
         $ai_stream: ctx.streaming,
         ...(ctx.conversationId && { $ai_session_id: ctx.conversationId }),
         ...(obs.promptName && { $ai_span_name: obs.promptName }),
         ...(opts.temperature !== undefined && {
            $ai_temperature: opts.temperature,
         }),
         ...(opts.maxTokens !== undefined && {
            $ai_max_tokens: opts.maxTokens,
         }),
         ...(toolsSpec(ctx.toolNames) && {
            $ai_tools: toolsSpec(ctx.toolNames),
         }),
         ...(obs.promptVersion !== undefined && {
            prompt_version: obs.promptVersion,
         }),
         ...obs.customProperties,
      };
   };

   const captureGeneration = (
      ctx: ChatMiddlewareContext,
      extra: Record<string, unknown>,
   ) => {
      safeCapture({
         distinctId: obs.distinctId,
         event: "$ai_generation",
         properties: {
            ...baseProps(ctx),
            rubi_tool_calls: toolCalls,
            rubi_tool_call_count: toolCalls.length,
            ...extra,
         },
      });
   };

   return {
      name: "posthog-ai-observability",

      onStart: () => {
         startTime = Date.now();
      },

      onChunk: (_ctx, chunk: StreamChunk) => {
         if (firstTokenTime === 0 && chunk.type === "TEXT_MESSAGE_CONTENT") {
            firstTokenTime = Date.now();
         }
      },

      onAfterToolCall: (_ctx, info: AfterToolCallInfo) => {
         toolCalls.push({
            id: info.toolCallId,
            name: info.toolName,
            ok: info.ok,
            durationMs: info.duration,
            error:
               info.ok || info.error == null
                  ? undefined
                  : toMessage(info.error),
         });
      },

      onFinish: (ctx, info) => {
         captureGeneration(ctx, {
            $ai_input: [
               ...ctx.systemPrompts.map((content) => ({
                  role: "system",
                  content,
               })),
               ...ctx.messages.map((m) => ({
                  role: m.role,
                  content: m.content,
               })),
            ],
            $ai_input_tokens: info.usage?.promptTokens,
            $ai_output_choices: info.content
               ? [{ role: "assistant", content: info.content }]
               : undefined,
            $ai_output_tokens: info.usage?.completionTokens,
            $ai_latency: info.duration / 1000,
            ...(info.finishReason && { $ai_stop_reason: info.finishReason }),
            ...(ctx.streaming &&
               firstTokenTime > 0 &&
               startTime > 0 && {
                  $ai_time_to_first_token: (firstTokenTime - startTime) / 1000,
               }),
         });
      },

      onError: (ctx, info) => {
         captureGeneration(ctx, {
            $ai_is_error: true,
            $ai_error: toMessage(info.error),
            $ai_latency: info.duration / 1000,
         });
      },
   };
}
