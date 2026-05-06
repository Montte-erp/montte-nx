import { z } from "zod";
import { defineSseEvents, type SseEventOf } from "@core/sse";

const agentEventDefinitions = {
   "agent.thread.title_updated": z.object({
      threadId: z.string().uuid(),
      title: z.string(),
   }),
   "agent.thread.created": z.object({
      threadId: z.string().uuid(),
   }),
   "agent.message.persisted": z.object({
      threadId: z.string().uuid(),
      messageId: z.string().uuid(),
      role: z.enum(["user", "assistant", "system"]),
   }),
   "agent.thread.suggestions_updated": z.object({
      threadId: z.string().uuid(),
      suggestions: z.array(z.string()),
   }),
} as const;

export const agentsSseEvents = defineSseEvents(agentEventDefinitions);

export type AgentsSseEvent = SseEventOf<typeof agentEventDefinitions>;
