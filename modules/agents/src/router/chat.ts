import { eventIterator } from "@orpc/server";
import { chat, type StreamChunk } from "@tanstack/ai";
import { z } from "zod";
import { getLogger } from "@core/logging/root";
import { protectedProcedure } from "@core/orpc/server";
import {
   uiMessageSchema,
   uiMessagesToRubiModelMessages,
} from "@modules/agents/messages";
import { buildRubiChatArgs, type RubiChatOptions } from "@modules/agents/rubi";
import {
   requireThread,
   withThreadChatMessages,
} from "@modules/agents/router/middlewares";

const logger = getLogger().child({ module: "agents.chat" });

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
   messages: z.array(uiMessageSchema).optional(),
});

const streamChunkShapeSchema = z.object({ type: z.string() }).passthrough();
const chatStreamEventSchema = z.custom<StreamChunk>(
   (value) => streamChunkShapeSchema.safeParse(value).success,
);

export type ChatInput = z.infer<typeof chatInputSchema>;
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

      let messages: RubiChatOptions["messages"] = context.chatMessages;
      if (input.messages !== undefined) {
         messages = uiMessagesToRubiModelMessages(input.messages);
      }

      const args = await buildRubiChatArgs({
         db: context.db,
         prompts: context.posthogPrompts,
         posthog: context.posthog,
         teamId: context.teamId,
         userId: context.userId,
         organizationId: context.organizationId,
         threadId: input.threadId,
         messages,
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
   .output(eventIterator(chatStreamEventSchema))
   .handler(async function* ({ context, input, signal }) {
      logger.info(
         { userId: context.userId, threadId: input.threadId },
         "rubi chat send start",
      );

      let messages: RubiChatOptions["messages"] = context.chatMessages;
      if (input.messages !== undefined) {
         messages = uiMessagesToRubiModelMessages(input.messages);
      }

      const args = await buildRubiChatArgs({
         db: context.db,
         prompts: context.posthogPrompts,
         posthog: context.posthog,
         teamId: context.teamId,
         userId: context.userId,
         organizationId: context.organizationId,
         threadId: input.threadId,
         messages,
         pageContext: input.pageContext,
         abortSignal: signal,
      });

      for await (const event of chat(args)) {
         yield event;
      }
      logger.info({ userId: context.userId }, "rubi chat send end");
   });

export const ping = protectedProcedure.handler(async ({ context }) => ({
   ok: true,
   teamId: context.teamId,
}));
