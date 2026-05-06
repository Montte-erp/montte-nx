import { eventIterator } from "@orpc/server";
import { chat, type StreamChunk } from "@tanstack/ai";
import type { UIMessage } from "@tanstack/ai";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import dayjs from "dayjs";
import { z } from "zod";
import { agentsSseEvents } from "@modules/agents/sse";
import {
   messageMetadataSchema,
   messages,
   type MessageMetadata,
} from "@core/database/schemas/messages";
import { threads } from "@core/database/schemas/threads";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { WebAppError } from "@core/logging/errors";
import { getLogger } from "@core/logging/root";
import { protectedProcedure } from "@core/orpc/server";
import { buildAgentChatArgs } from "@modules/agents/agent";
import { createPartsAccumulator } from "@modules/agents/parts-accumulator";
import { generateFollowUps } from "@modules/agents/follow-ups";
import { requireThread } from "@modules/agents/router/middlewares";
import {
   enqueueGenerateThreadTitle,
   generateThreadTitleWorkflow,
} from "@modules/agents/workflows/generate-title-workflow";

const logger = getLogger().child({ module: "agents.chat" });

void generateThreadTitleWorkflow;

const pageContextSchema = z
   .object({
      route: z.string().optional(),
      title: z.string().optional(),
      summary: z.string().optional(),
      skillHint: z.string().optional(),
   })
   .optional();

export type PageContext = z.infer<typeof pageContextSchema>;

const sendInputSchema = z.object({
   threadId: z.string().uuid(),
   text: z.string().min(1).max(50_000).optional(),
   replaceFromMessageId: z.string().uuid().optional(),
   regenerate: z.boolean().optional(),
   pageContext: pageContextSchema,
});

export type ChatInput = z.infer<typeof sendInputSchema>;

type TurnContext = ORPCContextWithOrganization & {
   thread: { id: string; title: string | null };
};

async function* streamAgentTurn(
   context: TurnContext,
   threadId: string,
   pageContext: PageContext,
   signal: AbortSignal | undefined,
): AsyncGenerator<StreamChunk> {
   const historyResult = await fromPromise(
      context.db
         .select({
            id: messages.id,
            role: messages.role,
            parts: messages.parts,
         })
         .from(messages)
         .where(eq(messages.threadId, threadId))
         .orderBy(asc(messages.createdAt)),
      () => WebAppError.internal("Falha ao carregar histórico."),
   );
   if (historyResult.isErr()) throw historyResult.error;
   const history: UIMessage[] = historyResult.value.map((row) => ({
      id: row.id,
      role: row.role as UIMessage["role"],
      parts: row.parts,
   }));

   const settings = await context.db.query.agentSettings.findFirst({
      where: (f, { eq: eqFn }) => eqFn(f.teamId, context.teamId),
   });

   const chatArgs = await buildAgentChatArgs({
      prompts: context.posthogPrompts,
      posthog: context.posthog,
      userId: context.userId,
      headers: context.headers,
      request: context.request,
      threadId,
      messages: history,
      pageContext,
      reasoningEffort: settings?.reasoningEffort ?? "low",
      abortSignal: signal,
   });

   const accumulator = createPartsAccumulator();

   for await (const event of chat(chatArgs)) {
      accumulator.consume(event);
      yield event;
   }

   const assistantParts = accumulator.parts;
   if (assistantParts.length === 0) {
      logger.warn({ threadId }, "agent chat produced no assistant parts");
      return;
   }

   const followUps = await generateFollowUps({
      history,
      assistantParts,
   });

   const metadata: MessageMetadata = messageMetadataSchema.parse({
      ...(accumulator.traceId && { traceId: accumulator.traceId }),
      ...(followUps.length > 0 && { followUps }),
   });

   const persistResult = await fromPromise(
      context.db.transaction(async (tx) => {
         const [row] = await tx
            .insert(messages)
            .values({
               threadId,
               role: "assistant",
               parts: assistantParts,
               metadata,
            })
            .returning({ id: messages.id });
         await tx
            .update(threads)
            .set({ lastMessageAt: dayjs().toDate() })
            .where(eq(threads.id, threadId));
         return row;
      }),
      () => WebAppError.internal("Falha ao salvar resposta."),
   );
   if (persistResult.isErr()) throw persistResult.error;
   const assistantRow = persistResult.value;

   if (context.thread.title === null) {
      await enqueueGenerateThreadTitle(context.workflowClient, {
         threadId,
         teamId: context.teamId,
         organizationId: context.organizationId,
      }).catch((err: unknown) =>
         logger.error({ err }, "failed enqueue title workflow"),
      );
   }

   if (assistantRow) {
      const publishResult = await agentsSseEvents.publish(
         context.redis,
         { kind: "team", id: context.teamId },
         {
            type: "agent.message.persisted",
            payload: {
               threadId,
               messageId: assistantRow.id,
               role: "assistant",
            },
         },
      );
      if (publishResult.isErr()) {
         logger.error(
            { err: publishResult.error },
            "failed publish SSE persisted",
         );
      }
   }
}

export const send = protectedProcedure
   .input(sendInputSchema)
   .use(requireThread, (input) => input.threadId)
   .output(eventIterator(z.custom<StreamChunk>()))
   .handler(async function* ({ context, input, signal }) {
      logger.info(
         { userId: context.userId, threadId: input.threadId },
         "agent chat send start",
      );

      const lockResult = await fromPromise(
         context.db.execute(
            sql`select pg_advisory_xact_lock(hashtext(${input.threadId}))`,
         ),
         () => WebAppError.internal("Falha ao iniciar conversa."),
      );
      if (lockResult.isErr()) throw lockResult.error;

      if (input.regenerate) {
         const lastUserResult = await fromPromise(
            context.db
               .select({ createdAt: messages.createdAt })
               .from(messages)
               .where(
                  and(
                     eq(messages.threadId, input.threadId),
                     eq(messages.role, "user"),
                  ),
               )
               .orderBy(asc(messages.createdAt)),
            () => WebAppError.internal("Falha ao carregar histórico."),
         );
         if (lastUserResult.isErr()) throw lastUserResult.error;
         const userRows = lastUserResult.value;
         const lastUser = userRows[userRows.length - 1];
         if (!lastUser) {
            throw WebAppError.notFound(
               "Nenhuma mensagem de usuário encontrada.",
            );
         }
         const truncateResult = await fromPromise(
            context.db.transaction((tx) =>
               tx
                  .delete(messages)
                  .where(
                     and(
                        eq(messages.threadId, input.threadId),
                        gte(messages.createdAt, lastUser.createdAt),
                        eq(messages.role, "assistant"),
                     ),
                  ),
            ),
            () => WebAppError.internal("Falha ao limpar resposta anterior."),
         );
         if (truncateResult.isErr()) throw truncateResult.error;
      } else if (input.replaceFromMessageId) {
         const targetResult = await fromPromise(
            context.db
               .select({ createdAt: messages.createdAt })
               .from(messages)
               .where(
                  and(
                     eq(messages.id, input.replaceFromMessageId),
                     eq(messages.threadId, input.threadId),
                  ),
               )
               .limit(1),
            () => WebAppError.internal("Falha ao localizar mensagem."),
         );
         if (targetResult.isErr()) throw targetResult.error;
         const target = targetResult.value[0];
         if (!target) throw WebAppError.notFound("Mensagem não encontrada.");

         const truncateResult = await fromPromise(
            context.db.transaction((tx) =>
               tx
                  .delete(messages)
                  .where(
                     and(
                        eq(messages.threadId, input.threadId),
                        gte(messages.createdAt, target.createdAt),
                     ),
                  ),
            ),
            () => WebAppError.internal("Falha ao truncar conversa."),
         );
         if (truncateResult.isErr()) throw truncateResult.error;
      }

      const userText = input.text;
      if (userText !== undefined) {
         const insertResult = await fromPromise(
            context.db.transaction(async (tx) => {
               await tx.insert(messages).values({
                  threadId: input.threadId,
                  role: "user",
                  parts: [{ type: "text", content: userText }],
                  metadata: input.pageContext
                     ? { pageContext: input.pageContext }
                     : null,
               });
            }),
            () => WebAppError.internal("Falha ao salvar mensagem."),
         );
         if (insertResult.isErr()) throw insertResult.error;
      }

      yield* streamAgentTurn(
         context,
         input.threadId,
         input.pageContext,
         signal,
      );
      logger.info({ userId: context.userId }, "agent chat send end");
   });

export const ping = protectedProcedure.handler(async ({ context }) => ({
   ok: true,
   teamId: context.teamId,
}));
