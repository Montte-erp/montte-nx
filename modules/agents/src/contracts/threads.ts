import { z } from "zod";

export const threadIdInputSchema = z.object({
   threadId: z.string().uuid(),
});

export const createThreadInputSchema = z.object({
   title: z.string().min(1).max(200).optional(),
});

export const updateThreadInputSchema = z.object({
   threadId: z.string().uuid(),
   title: z.string().min(1).max(200),
});

export const listThreadsInputSchema = z
   .object({
      limit: z.number().int().min(1).max(100).default(50),
   })
   .optional();

export const messagePartSchema = z.object({ type: z.string() }).passthrough();

export const appendMessageInputSchema = z.object({
   threadId: z.string().uuid(),
   id: z.string().uuid().optional(),
   role: z.enum(["system", "user", "assistant", "tool"]),
   parts: z.array(messagePartSchema),
   toolCallId: z.string().optional(),
});

export const listMessagesInputSchema = threadIdInputSchema;

export const syncMessagesInputSchema = z.object({
   threadId: z.string().uuid(),
   messages: z.array(
      z.object({
         role: z.enum(["system", "user", "assistant", "tool"]),
         parts: z.array(messagePartSchema),
      }),
   ),
});
