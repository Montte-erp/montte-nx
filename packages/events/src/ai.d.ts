import { z } from "zod";
import { type EmitFn } from "./catalog";
export declare const AI_PRICING: Record<string, string>;
export declare const AI_EVENTS: {
   readonly "ai.chat_message": "ai.chat_message";
   readonly "ai.agent_action": "ai.agent_action";
};
export type AiEventName = (typeof AI_EVENTS)[keyof typeof AI_EVENTS];
export declare const aiChatMessageEventSchema: z.ZodObject<
   {
      chatId: z.ZodUUID;
      agentId: z.ZodOptional<z.ZodUUID>;
      model: z.ZodString;
      provider: z.ZodString;
      role: z.ZodEnum<{
         assistant: "assistant";
         user: "user";
      }>;
      promptTokens: z.ZodNumber;
      completionTokens: z.ZodNumber;
      totalTokens: z.ZodNumber;
      latencyMs: z.ZodNumber;
   },
   z.core.$strip
>;
export type AiChatMessageEvent = z.infer<typeof aiChatMessageEventSchema>;
export declare function emitAiChatMessage(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: AiChatMessageEvent,
): Promise<void>;
export declare const aiAgentActionEventSchema: z.ZodObject<
   {
      agentId: z.ZodUUID;
      action: z.ZodString;
      model: z.ZodString;
      provider: z.ZodString;
      promptTokens: z.ZodNumber;
      completionTokens: z.ZodNumber;
      totalTokens: z.ZodNumber;
      latencyMs: z.ZodNumber;
   },
   z.core.$strip
>;
export type AiAgentActionEvent = z.infer<typeof aiAgentActionEventSchema>;
export declare function emitAiAgentAction(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: AiAgentActionEvent,
): Promise<void>;
//# sourceMappingURL=ai.d.ts.map
