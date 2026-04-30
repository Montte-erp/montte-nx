import { eventIterator } from "@orpc/server";
import { chat } from "@tanstack/ai";
import { z } from "zod";
import { getLogger } from "@core/logging/root";
import { protectedProcedure } from "@core/orpc/server";
import { buildRubiChatArgs } from "@modules/agents/rubi";
import {
   requireThread,
   withThreadChatMessages,
} from "@modules/agents/router/middlewares";

const logger = getLogger().child({ module: "agents.chat" });

const chatRoleSchema = z.enum(["user", "assistant", "tool"]);

const chatMessageSchema = z.object({
   id: z.string().optional(),
   role: chatRoleSchema,
   content: z.string(),
   toolCallId: z.string().optional(),
});

const pageContextSchema = z
   .object({
      route: z.string().optional(),
      title: z.string().optional(),
      summary: z.string().optional(),
      skillHint: z.string().optional(),
   })
   .optional();

const chatInputSchema = z.object({
   threadId: z.string().uuid(),
   turnId: z.string().optional(),
   pageContext: pageContextSchema,
});

const chatStreamEventSchema = z.object({ type: z.string() }).passthrough();

export type ChatInput = z.infer<typeof chatInputSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;
export type PageContext = z.infer<typeof pageContextSchema>;

export const stream = protectedProcedure
   .input(chatInputSchema)
   .use(requireThread, (input) => input.threadId)
   .use(withThreadChatMessages, (input) => input.threadId)
   .output(eventIterator(chatStreamEventSchema))
   .handler(async function* ({ context, input, signal }) {
      logger.info(
         { userId: context.userId, threadId: input.threadId },
         "rubi chat stream start",
      );

      const args = await buildRubiChatArgs({
         db: context.db,
         prompts: context.posthogPrompts,
         posthog: context.posthog,
         teamId: context.teamId,
         userId: context.userId,
         organizationId: context.organizationId,
         threadId: input.threadId,
         messages: context.chatMessages,
         pageContext: input.pageContext,
         abortSignal: signal,
      });

      for await (const event of chat(args)) {
         yield event;
      }

      logger.info({ userId: context.userId }, "rubi chat stream end");
   });

export const send = protectedProcedure
   .input(chatInputSchema)
   .use(requireThread, (input) => input.threadId)
   .use(withThreadChatMessages, (input) => input.threadId)
   .handler(async ({ context, input, signal }) => {
      logger.info(
         { userId: context.userId, threadId: input.threadId },
         "rubi chat send start",
      );

      const args = await buildRubiChatArgs({
         db: context.db,
         prompts: context.posthogPrompts,
         posthog: context.posthog,
         teamId: context.teamId,
         userId: context.userId,
         organizationId: context.organizationId,
         threadId: input.threadId,
         messages: context.chatMessages,
         pageContext: input.pageContext,
         abortSignal: signal,
      });

      const text = await chat({ ...args, stream: false });
      logger.info({ userId: context.userId }, "rubi chat send end");
      return { threadId: input.threadId, text };
   });

export const ping = protectedProcedure.handler(async ({ context }) => ({
   ok: true,
   teamId: context.teamId,
}));
