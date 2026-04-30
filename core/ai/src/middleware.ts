import { fromThrowable } from "neverthrow";
import { z } from "zod";
import type { PostHog } from "@core/posthog/server";
import type {
   AfterToolCallInfo,
   ChatMiddleware,
   ChatMiddlewareContext,
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

export type AiObservabilityContext = z.infer<typeof observabilityContextSchema>;
type ToolCallSummary = z.infer<typeof toolCallSummarySchema>;

function toMessage(error: unknown): string {
   return (
      errorWithMessageSchema.safeParse(error).data?.message ?? String(error)
   );
}

export function createPosthogAiMiddleware(
   obs: AiObservabilityContext,
): ChatMiddleware {
   const toolCalls: ToolCallSummary[] = [];
   const safeCapture = fromThrowable(obs.posthog.capture.bind(obs.posthog));

   const baseProps = (ctx: ChatMiddlewareContext) => ({
      $ai_trace_id: ctx.requestId,
      $ai_span_id: ctx.streamId,
      $ai_model: ctx.model,
      $ai_provider: ctx.provider,
      $ai_stream: ctx.streaming,
      ...(ctx.conversationId && { $ai_session_id: ctx.conversationId }),
      ...(obs.promptName && { $ai_span_name: obs.promptName }),
      ...(obs.promptVersion !== undefined && {
         prompt_version: obs.promptVersion,
      }),
      ...obs.customProperties,
   });

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
