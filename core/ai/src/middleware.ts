import { otelMiddleware } from "@tanstack/ai/middlewares/otel";
import { getAiTracer } from "@core/logging/otel";
import type { ChatMiddleware } from "@tanstack/ai";

export interface AiObservabilityContext {
   distinctId: string;
   organizationId?: string;
   teamId?: string;
   conversationId?: string;
   promptName?: string;
   promptVersion?: number;
   customProperties?: Record<string, string | number | boolean>;
}

const MAX_CONTENT_CHARS = 8000;

function redact(text: string): string {
   return text.length <= MAX_CONTENT_CHARS
      ? text
      : text.slice(0, MAX_CONTENT_CHARS) + "…[truncated]";
}

export function createAiObservabilityMiddleware(
   obs: AiObservabilityContext,
): ChatMiddleware {
   return otelMiddleware({
      tracer: getAiTracer(),
      captureContent: true,
      redact,
      spanNameFormatter: (info) =>
         info.kind === "chat" && obs.promptName
            ? `chat ${obs.promptName}`
            : `${info.kind}`,
      attributeEnricher: () => ({
         "posthog.distinct_id": obs.distinctId,
         ...(obs.organizationId && {
            "$groups.organization": obs.organizationId,
         }),
         ...(obs.teamId && { "$groups.team": obs.teamId }),
         ...(obs.conversationId && {
            "gen_ai.conversation.id": obs.conversationId,
         }),
         ...(obs.promptName && { "tanstack.ai.prompt.name": obs.promptName }),
         ...(obs.promptVersion !== undefined && {
            "tanstack.ai.prompt.version": obs.promptVersion,
         }),
         ...obs.customProperties,
      }),
   });
}
