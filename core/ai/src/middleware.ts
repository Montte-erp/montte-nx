import type { PostHog } from "@core/posthog/server";
import type {
   AfterToolCallInfo,
   ChatMiddleware,
   ChatMiddlewareContext,
} from "@tanstack/ai";

export type AiObservabilityContext = {
   posthog: PostHog;
   distinctId: string;
   promptName?: string;
   promptVersion?: number;
   customProperties?: Record<string, unknown>;
};

interface ToolCallSummary {
   id: string;
   name: string;
   ok: boolean;
   durationMs: number;
   error?: string;
}

export function createPosthogAiMiddleware(
   obs: AiObservabilityContext,
): ChatMiddleware {
   const toolCalls: ToolCallSummary[] = [];

   const baseProps = (ctx: ChatMiddlewareContext) => ({
      $ai_trace_id: ctx.requestId,
      $ai_model: ctx.model,
      $ai_provider: ctx.provider,
      $ai_stream: ctx.streaming,
      ...(obs.promptName && { $ai_span_name: obs.promptName }),
      ...(obs.promptVersion !== undefined && {
         prompt_version: obs.promptVersion,
      }),
      ...obs.customProperties,
   });

   return {
      name: "posthog-ai-observability",

      onAfterToolCall: (_ctx, info: AfterToolCallInfo) => {
         toolCalls.push({
            id: info.toolCallId,
            name: info.toolName,
            ok: info.ok,
            durationMs: info.duration,
            error:
               !info.ok && info.error
                  ? info.error instanceof Error
                     ? info.error.message
                     : String(info.error)
                  : undefined,
         });
      },

      onFinish: (ctx, info) => {
         const input = [
            ...ctx.systemPrompts.map((sp) => ({
               role: "system" as const,
               content: sp,
            })),
            ...ctx.messages.map((m) => ({ role: m.role, content: m.content })),
         ];

         obs.posthog.capture({
            distinctId: obs.distinctId,
            event: "$ai_generation",
            properties: {
               ...baseProps(ctx),
               $ai_input: input,
               $ai_input_tokens: info.usage?.promptTokens,
               $ai_output_choices: info.content
                  ? [{ role: "assistant", content: info.content }]
                  : undefined,
               $ai_output_tokens: info.usage?.completionTokens,
               $ai_latency: info.duration / 1000,
               rubi_tool_calls: toolCalls,
               rubi_tool_call_count: toolCalls.length,
            },
         });
      },

      onError: (ctx, info) => {
         obs.posthog.capture({
            distinctId: obs.distinctId,
            event: "$ai_generation",
            properties: {
               ...baseProps(ctx),
               $ai_is_error: true,
               $ai_error:
                  info.error instanceof Error
                     ? info.error.message
                     : String(info.error),
               $ai_latency: info.duration / 1000,
               rubi_tool_calls: toolCalls,
               rubi_tool_call_count: toolCalls.length,
            },
         });
      },
   };
}
