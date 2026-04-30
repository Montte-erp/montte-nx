import {
   convertMessagesToModelMessages,
   type ContentPart,
   type ConstrainedModelMessage,
   type MessagePart,
   type ModelMessage,
   type TextPart,
   type ToolCall,
   type UIMessage,
} from "@tanstack/ai";
import type { OpenRouterMessageMetadataByModality } from "@tanstack/ai-openrouter";
import type { OpenRouterTextMetadata } from "@tanstack/ai-openrouter";
import { z } from "zod";

const contentPartSourceSchema = z.union([
   z.object({
      type: z.literal("data"),
      value: z.string(),
      mimeType: z.string(),
   }),
   z.object({
      type: z.literal("url"),
      value: z.string(),
      mimeType: z.string().optional(),
   }),
]);

const openRouterTextMetadataSchema: z.ZodType<OpenRouterTextMetadata> = z
   .object({})
   .passthrough();

const textPartSchema: z.ZodType<TextPart<OpenRouterTextMetadata>> = z.object({
   type: z.literal("text"),
   content: z.string(),
   metadata: openRouterTextMetadataSchema.optional(),
});

const mediaPartSchema = z.object({
   type: z.enum(["image", "audio", "video", "document"]),
   source: contentPartSourceSchema,
   metadata: z.unknown().optional(),
});

const toolCallStateSchema = z.enum([
   "awaiting-input",
   "input-streaming",
   "input-complete",
   "approval-requested",
   "approval-responded",
]);

const toolResultStateSchema = z.enum(["streaming", "complete", "error"]);

const toolCallPartSchema = z.object({
   type: z.literal("tool-call"),
   id: z.string(),
   name: z.string(),
   arguments: z.string(),
   input: z.unknown().optional(),
   state: toolCallStateSchema,
   approval: z
      .object({
         id: z.string(),
         needsApproval: z.boolean(),
         approved: z.boolean().optional(),
      })
      .optional(),
   output: z.unknown().optional(),
});

const toolResultPartSchema = z.object({
   type: z.literal("tool-result"),
   toolCallId: z.string(),
   content: z.string(),
   state: toolResultStateSchema,
   error: z.string().optional(),
});

const thinkingPartSchema = z.object({
   type: z.literal("thinking"),
   content: z.string(),
});

export const messagePartSchema: z.ZodType<MessagePart> = z.union([
   textPartSchema,
   mediaPartSchema,
   toolCallPartSchema,
   toolResultPartSchema,
   thinkingPartSchema,
]);

export const uiMessageSchema: z.ZodType<UIMessage> = z.object({
   id: z.string(),
   role: z.enum(["system", "user", "assistant"]),
   parts: z.array(messagePartSchema),
   createdAt: z.date().optional(),
});

export const toolCallSchema: z.ZodType<ToolCall> = z.object({
   id: z.string(),
   type: z.literal("function"),
   function: z.object({
      name: z.string(),
      arguments: z.string(),
   }),
   providerMetadata: z.record(z.string(), z.unknown()).optional(),
});

export type RubiModelMessage = ConstrainedModelMessage<{
   inputModalities: readonly ["text"];
   messageMetadataByModality: OpenRouterMessageMetadataByModality;
}>;

export const rubiModelMessageSchema: z.ZodType<RubiModelMessage> = z.object({
   role: z.enum(["user", "assistant", "tool"]),
   content: z.union([z.string(), z.null(), z.array(textPartSchema)]),
   name: z.string().optional(),
   toolCalls: z.array(toolCallSchema).optional(),
   toolCallId: z.string().optional(),
});

const contentPartSchema: z.ZodType<ContentPart> = z.union([
   textPartSchema,
   mediaPartSchema,
]);

export const modelMessageSchema: z.ZodType<ModelMessage> = z.object({
   role: z.enum(["user", "assistant", "tool"]),
   content: z.union([z.string(), z.null(), z.array(contentPartSchema)]),
   name: z.string().optional(),
   toolCalls: z.array(toolCallSchema).optional(),
   toolCallId: z.string().optional(),
});

export function parseUiMessages(value: unknown) {
   return z.array(uiMessageSchema).safeParse(value);
}

export function parseMessageParts(value: unknown) {
   return z.array(messagePartSchema).safeParse(value);
}

export function uiMessagesToRubiModelMessages(messages: UIMessage[]) {
   return convertMessagesToModelMessages(messages).flatMap((message) => {
      const parsed = rubiModelMessageSchema.safeParse(message);
      if (!parsed.success) return [];
      return [parsed.data];
   });
}

export function dbMessagesToUIMessages(
   rows: Array<{
      id: string;
      role: "system" | "user" | "assistant" | "tool";
      parts: unknown;
   }>,
) {
   return rows.flatMap((row) => {
      if (row.role === "tool") return [];
      const parts = parseMessageParts(row.parts);
      if (!parts.success) return [];
      return [{ id: row.id, role: row.role, parts: parts.data }];
   });
}

export function uiMessagesToThreadMessages(messages: UIMessage[]) {
   return messages.map((message) => ({
      role: message.role,
      parts: message.parts,
   }));
}

export function uiMessagesOnly(messages: Array<UIMessage | ModelMessage>) {
   return messages.flatMap((message) => {
      const parsed = uiMessageSchema.safeParse(message);
      if (!parsed.success) return [];
      return [parsed.data];
   });
}

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
