import { type MessagePart, type UIMessage } from "@tanstack/ai";
import { z } from "zod";

export const uiMessageSchema = z.custom<UIMessage>(
   (value) =>
      z
         .object({
            id: z.string(),
            role: z.enum(["system", "user", "assistant"]),
            parts: z.array(z.object({ type: z.string() }).passthrough()),
         })
         .passthrough()
         .safeParse(value).success,
);

export function pendingApprovalIds(messages: UIMessage[]) {
   return messages.flatMap((message) => {
      if (message.role !== "assistant") return [];
      return message.parts.flatMap((part) => {
         if (part.type !== "tool-call") return [];
         if (part.state !== "approval-requested") return [];
         if (part.approval === undefined) return [];
         if (part.approval.approved !== undefined) return [];
         return [part.approval.id];
      });
   });
}

export function textPartContent(part: MessagePart) {
   if (part.type !== "text") return null;
   return part.content;
}

export function thinkingPartContent(part: MessagePart) {
   if (part.type !== "thinking") return null;
   return part.content;
}

export function toolCallPartView(part: MessagePart) {
   if (part.type !== "tool-call") return null;
   return {
      id: part.id,
      name: part.name,
      arguments: part.arguments,
      state: part.state,
      approval: part.approval,
      output: part.output,
   };
}
