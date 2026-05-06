import { eventIterator } from "@orpc/server";
import { chat, type StreamChunk, type UIMessage } from "@tanstack/ai";
import { z } from "zod";
import { getLogger } from "@core/logging/root";
import { protectedProcedure } from "@core/orpc/server";
import { buildAgentChatArgs } from "@modules/agents/agent";
import { requireThread } from "@modules/agents/router/middlewares";
import { uiMessageSchema } from "@modules/agents/router/threads";

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

export type ChatInput = z.infer<typeof chatInputSchema>;
export type PageContext = z.infer<typeof pageContextSchema>;

export const send = protectedProcedure
   .input(chatInputSchema)
   .use(requireThread, (input) => input.threadId)
   .output(eventIterator(z.custom<StreamChunk>()))
   .handler(async function* ({ context, input, signal }) {
      logger.info(
         { userId: context.userId, threadId: input.threadId },
         "agent chat send start",
      );

      const uiMessages: UIMessage[] = input.messages ?? context.thread.messages;

      const args = await buildAgentChatArgs({
         prompts: context.posthogPrompts,
         posthog: context.posthog,
         userId: context.userId,
         headers: context.headers,
         request: context.request,
         threadId: input.threadId,
         messages: uiMessages,
         pageContext: input.pageContext,
         abortSignal: signal,
      });

      for await (const event of chat(args)) {
         yield event;
      }

      logger.info({ userId: context.userId }, "agent chat send end");
   });

export const ping = protectedProcedure.handler(async ({ context }) => ({
   ok: true,
   teamId: context.teamId,
}));
