import dayjs from "dayjs";
import { asc, eq, max } from "drizzle-orm";
import { eventIterator } from "@orpc/server";
import { chat } from "@tanstack/ai";
import { fromPromise } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { threadMessages, threads } from "@core/database/schemas/threads";
import { getLogger } from "@core/logging/root";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { buildRubiChatArgs } from "@modules/agents/rubi";
import {
   chatInputSchema,
   chatStreamEventSchema,
   type ChatMessage,
} from "../contracts/chat";
import { requireThread } from "./middlewares";

const logger = getLogger().child({ module: "agents.chat" });

interface AccumulatedToolCall {
   id: string;
   name: string;
   args: string;
}

interface AssistantAccumulator {
   text: string;
   toolCalls: Map<string, AccumulatedToolCall>;
}

function applyEvent(
   acc: AssistantAccumulator,
   event: { type: string } & Record<string, unknown>,
) {
   const type = event.type;
   if (type === "TEXT_MESSAGE_CONTENT" && typeof event.delta === "string") {
      acc.text += event.delta;
      return;
   }
   if (type === "TOOL_CALL_START") {
      const id = String(event.toolCallId ?? "");
      const name = String(event.toolCallName ?? "");
      if (id) acc.toolCalls.set(id, { id, name, args: "" });
      return;
   }
   if (type === "TOOL_CALL_ARGS") {
      const id = String(event.toolCallId ?? "");
      const delta = String(event.delta ?? "");
      const existing = acc.toolCalls.get(id);
      if (existing) existing.args += delta;
   }
}

async function persistAssistantMessage(
   db: DatabaseInstance,
   threadId: string,
   acc: AssistantAccumulator,
) {
   if (!acc.text && acc.toolCalls.size === 0) return;
   const parts: Array<Record<string, unknown>> = [];
   if (acc.text) parts.push({ type: "text", content: acc.text });
   for (const tc of acc.toolCalls.values()) {
      parts.push({
         type: "tool-call",
         id: tc.id,
         name: tc.name,
         arguments: tc.args,
      });
   }
   await db.transaction(async (tx) => {
      const seqRows = await tx
         .select({ next: max(threadMessages.sequence) })
         .from(threadMessages)
         .where(eq(threadMessages.threadId, threadId));
      const sequence = (seqRows[0]?.next ?? -1) + 1;
      await tx.insert(threadMessages).values({
         threadId,
         sequence,
         role: "assistant",
         parts,
      });
      await tx
         .update(threads)
         .set({ lastMessageAt: dayjs().toDate() })
         .where(eq(threads.id, threadId));
   });
}

function partsToContent(parts: unknown): string {
   if (!Array.isArray(parts)) return "";
   const out: string[] = [];
   for (const part of parts) {
      if (
         part &&
         typeof part === "object" &&
         "type" in part &&
         part.type === "text" &&
         "content" in part &&
         typeof part.content === "string"
      ) {
         out.push(part.content);
      }
   }
   return out.join("");
}

export const stream = protectedProcedure
   .input(chatInputSchema)
   .use(requireThread, (input) => input.threadId)
   .output(eventIterator(chatStreamEventSchema))
   .handler(async function* ({ context, input, signal }) {
      logger.info(
         { userId: context.userId, threadId: input.threadId },
         "rubi chat stream start",
      );

      const history = await context.db
         .select()
         .from(threadMessages)
         .where(eq(threadMessages.threadId, input.threadId))
         .orderBy(asc(threadMessages.sequence));

      const messages: ChatMessage[] = [];
      for (const row of history) {
         if (row.role === "system") continue;
         messages.push({
            id: row.id,
            role: row.role,
            content: partsToContent(row.parts),
            toolCallId: row.toolCallId ?? undefined,
         });
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

      const acc: AssistantAccumulator = { text: "", toolCalls: new Map() };
      const iterable = chat(args);

      for await (const event of iterable) {
         applyEvent(acc, event);
         yield event;
      }

      await persistAssistantMessage(context.db, input.threadId, acc);

      logger.info({ userId: context.userId }, "rubi chat stream end");
   });

async function loadHistory(
   db: DatabaseInstance,
   threadId: string,
): Promise<ChatMessage[]> {
   const rows = await db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.threadId, threadId))
      .orderBy(asc(threadMessages.sequence));
   const messages: ChatMessage[] = [];
   for (const row of rows) {
      if (row.role === "system") continue;
      messages.push({
         id: row.id,
         role: row.role,
         content: partsToContent(row.parts),
         toolCallId: row.toolCallId ?? undefined,
      });
   }
   return messages;
}

export const send = protectedProcedure
   .input(chatInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input, signal }) => {
      logger.info(
         { userId: context.userId, threadId: input.threadId },
         "rubi chat send start",
      );

      const messages = await loadHistory(context.db, input.threadId);
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

      const acc: AssistantAccumulator = { text: "", toolCalls: new Map() };
      const iterable = chat(args);
      for await (const event of iterable) {
         applyEvent(acc, event);
      }

      await persistAssistantMessage(context.db, input.threadId, acc);

      logger.info({ userId: context.userId }, "rubi chat send end");
      return {
         threadId: input.threadId,
         text: acc.text,
         toolCalls: Array.from(acc.toolCalls.values()),
      };
   });

export const ping = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      Promise.resolve({ ok: true, teamId: context.teamId }),
      () => WebAppError.internal("Falha ao verificar status do Rubi."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});
