import { z } from "zod";

import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const AI_PRICING: Record<string, string> = {
   "ai.chat_message": "0.020000",
   "ai.agent_action": "0.040000",
   "ai.keyword_derived": "0.010000",
};

export const AI_EVENTS = {
   "ai.chat_message": "ai.chat_message",
   "ai.agent_action": "ai.agent_action",
   "ai.keyword_derived": "ai.keyword_derived",
} as const;

export type AiEventName = (typeof AI_EVENTS)[keyof typeof AI_EVENTS];

export const aiChatMessageEventSchema = z.object({
   chatId: z.uuid(),
   agentId: z.uuid().optional(),
   model: z.string(),
   provider: z.string(),
   role: z.enum(["user", "assistant"]),
   promptTokens: z.number().int().nonnegative(),
   completionTokens: z.number().int().nonnegative(),
   totalTokens: z.number().int().nonnegative(),
   latencyMs: z.number().nonnegative(),
});
export type AiChatMessageEvent = z.infer<typeof aiChatMessageEventSchema>;

export function emitAiChatMessage(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: AiChatMessageEvent,
) {
   return emit({
      ...ctx,
      eventName: AI_EVENTS["ai.chat_message"],
      eventCategory: EVENT_CATEGORIES.ai,
      properties,
   });
}

export const aiAgentActionEventSchema = z.object({
   agentId: z.uuid(),
   action: z.string(),
   model: z.string(),
   provider: z.string(),
   promptTokens: z.number().int().nonnegative(),
   completionTokens: z.number().int().nonnegative(),
   totalTokens: z.number().int().nonnegative(),
   latencyMs: z.number().nonnegative(),
});
export type AiAgentActionEvent = z.infer<typeof aiAgentActionEventSchema>;

export function emitAiAgentAction(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: AiAgentActionEvent,
) {
   return emit({
      ...ctx,
      eventName: AI_EVENTS["ai.agent_action"],
      eventCategory: EVENT_CATEGORIES.ai,
      properties,
   });
}

export const aiKeywordDerivedEventSchema = z.object({
   categoryId: z.uuid(),
   keywordCount: z.number().int().nonnegative(),
   model: z.string(),
   latencyMs: z.number().nonnegative(),
});
export type AiKeywordDerivedEvent = z.infer<typeof aiKeywordDerivedEventSchema>;

export function emitAiKeywordDerived(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: AiKeywordDerivedEvent,
) {
   return emit({
      ...ctx,
      eventName: AI_EVENTS["ai.keyword_derived"],
      eventCategory: EVENT_CATEGORIES.ai,
      properties,
   });
}
