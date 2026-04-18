import type { ChatMiddleware } from "@tanstack/ai";
import type { PostHog } from "@core/posthog/server";

export type AiObservabilityContext = {
   posthog: PostHog;
   distinctId: string;
   promptName?: string;
   promptVersion?: number;
};

export function createPosthogAiMiddleware(
   obs: AiObservabilityContext,
): ChatMiddleware {
   return {
      name: "posthog-ai-observability",

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
               $ai_trace_id: ctx.requestId,
               $ai_model: ctx.model,
               $ai_provider: ctx.provider,
               $ai_input: input,
               $ai_input_tokens: info.usage?.promptTokens,
               $ai_output_choices: info.content
                  ? [{ role: "assistant", content: info.content }]
                  : undefined,
               $ai_output_tokens: info.usage?.completionTokens,
               $ai_latency: info.duration / 1000,
               $ai_stream: ctx.streaming,
               ...(obs.promptName && { $ai_span_name: obs.promptName }),
               ...(obs.promptVersion !== undefined && {
                  prompt_version: obs.promptVersion,
               }),
            },
         });
      },

      onError: (ctx, info) => {
         obs.posthog.capture({
            distinctId: obs.distinctId,
            event: "$ai_generation",
            properties: {
               $ai_trace_id: ctx.requestId,
               $ai_model: ctx.model,
               $ai_provider: ctx.provider,
               $ai_is_error: true,
               $ai_error:
                  info.error instanceof Error
                     ? info.error.message
                     : String(info.error),
               $ai_latency: info.duration / 1000,
               $ai_stream: ctx.streaming,
            },
         });
      },
   };
}
