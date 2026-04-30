import { z } from "zod";

export const chatRoleSchema = z.enum(["user", "assistant", "tool"]);

export const toolCallSchema = z.object({
   id: z.string(),
   name: z.string(),
   arguments: z.string(),
});

export const chatMessageSchema = z.object({
   id: z.string().optional(),
   role: chatRoleSchema,
   content: z.string().nullable(),
   toolCalls: z.array(toolCallSchema).optional(),
   toolCallId: z.string().optional(),
});

export const pageContextSchema = z
   .object({
      route: z.string().optional(),
      title: z.string().optional(),
      summary: z.string().optional(),
      skillHint: z.string().optional(),
   })
   .optional();

export const chatInputSchema = z.object({
   threadId: z.string().uuid(),
   turnId: z.string().optional(),
   pageContext: pageContextSchema,
});

export const chatStreamEventSchema = z
   .object({ type: z.string() })
   .passthrough();

export type ChatInput = z.infer<typeof chatInputSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;
export type PageContext = z.infer<typeof pageContextSchema>;
