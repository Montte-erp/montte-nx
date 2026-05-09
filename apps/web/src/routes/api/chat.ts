import "@/polyfill";

import { toHttpResponse, type UIMessage } from "@tanstack/ai";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
   messagePageContextSchema,
   messages,
} from "@core/database/schemas/messages";
import { getLogger } from "@core/logging/root";
import { buildWebContext } from "@core/orpc/server";
import { createAgentChat } from "@modules/agents/agent";

const logger = getLogger().child({ module: "api.chat" });

const bodySchema = z.object({
   threadId: z.string().uuid(),
   text: z.string().min(1).max(50_000).optional(),
   replaceFromMessageId: z.string().uuid().optional(),
   regenerate: z.boolean().optional(),
   pageContext: messagePageContextSchema.optional(),
});

const defaultChatSettings = {
   reasoningEffort: "high",
} satisfies { reasoningEffort: "high" | "xhigh" };

const chatSettingsSchema = z
   .object({
      reasoningEffort: z.enum(["high", "xhigh"]).default("high"),
   })
   .default(() => defaultChatSettings);

async function handlePost({ request }: { request: Request }) {
   const ctx = await buildWebContext(request);
   if (!ctx) return new Response("Unauthorized", { status: 401 });

   const json = await fromPromise(request.json(), () => null);
   if (json.isErr()) return new Response("Bad request", { status: 400 });
   const parsed = bodySchema.safeParse(json.value);
   if (!parsed.success) return new Response("Invalid input", { status: 400 });
   const input = parsed.data;

   const thread = await ctx.db.query.threads.findFirst({
      where: (f, { eq: eqFn }) => eqFn(f.id, input.threadId),
   });
   if (
      !thread ||
      thread.teamId !== ctx.teamId ||
      thread.organizationId !== ctx.organizationId ||
      thread.userId !== ctx.userId
   ) {
      return new Response("Conversa não encontrada.", { status: 404 });
   }

   logger.info(
      { userId: ctx.userId, threadId: input.threadId },
      "agent chat send start",
   );

   const historyRows = await ctx.db.transaction(async (tx) => {
      await tx.execute(
         sql`select pg_advisory_xact_lock(hashtext(${input.threadId}))`,
      );

      if (input.regenerate) {
         const userRows = await tx
            .select({ createdAt: messages.createdAt })
            .from(messages)
            .where(
               and(
                  eq(messages.threadId, input.threadId),
                  eq(messages.role, "user"),
               ),
            )
            .orderBy(asc(messages.createdAt));
         const lastUser = userRows.at(-1);
         if (!lastUser) return null;
         await tx
            .delete(messages)
            .where(
               and(
                  eq(messages.threadId, input.threadId),
                  gte(messages.createdAt, lastUser.createdAt),
                  eq(messages.role, "assistant"),
               ),
            );
      } else if (input.replaceFromMessageId) {
         const target = await tx
            .select({ createdAt: messages.createdAt })
            .from(messages)
            .where(
               and(
                  eq(messages.id, input.replaceFromMessageId),
                  eq(messages.threadId, input.threadId),
               ),
            )
            .limit(1);
         const row = target[0];
         if (!row) return null;
         await tx
            .delete(messages)
            .where(
               and(
                  eq(messages.threadId, input.threadId),
                  gte(messages.createdAt, row.createdAt),
               ),
            );
      }

      if (input.text !== undefined) {
         await tx.insert(messages).values({
            threadId: input.threadId,
            role: "user",
            parts: [{ type: "text", content: input.text }],
            metadata: input.pageContext
               ? { pageContext: input.pageContext }
               : null,
         });
      }

      return tx
         .select({
            id: messages.id,
            role: messages.role,
            parts: messages.parts,
         })
         .from(messages)
         .where(eq(messages.threadId, input.threadId))
         .orderBy(asc(messages.createdAt));
   });
   if (historyRows === null) {
      return new Response("Mensagem não encontrada.", { status: 404 });
   }
   const history: UIMessage[] = historyRows.map((row) => ({
      id: row.id,
      role: row.role,
      parts: row.parts,
   }));

   const settings = await ctx.db.query.agentSettings.findFirst({
      where: (f, { eq: eqFn }) => eqFn(f.teamId, ctx.teamId),
   });
   const chatSettings = chatSettingsSchema.parse(settings);

   const abortController = new AbortController();
   request.signal.addEventListener("abort", () => abortController.abort(), {
      once: true,
   });

   const stream = await createAgentChat({
      prompts: ctx.posthogPrompts,
      userId: ctx.userId,
      headers: ctx.headers,
      request: ctx.request,
      threadId: input.threadId,
      messages: history,
      pageContext: input.pageContext,
      reasoningEffort: chatSettings.reasoningEffort,
      abortSignal: abortController.signal,
   });

   return toHttpResponse(stream, {
      abortController,
      headers: { "Content-Type": "application/x-ndjson" },
   });
}

export const Route = createFileRoute("/api/chat")({
   server: {
      handlers: {
         POST: handlePost,
      },
   },
});
