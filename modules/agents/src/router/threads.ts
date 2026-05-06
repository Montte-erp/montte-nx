import { chat } from "@tanstack/ai";
import type { UIMessage } from "@tanstack/ai";
import dayjs from "dayjs";
import { and, asc, eq, inArray } from "drizzle-orm";
import { err, fromPromise, ok, safeTry } from "neverthrow";
import { z } from "zod";
import { messages } from "@core/database/schemas/messages";
import {
   insertThreadSchema,
   threads,
   threadSchema,
} from "@core/database/schemas/threads";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { flashModel } from "@core/ai/models";
import { requireThread } from "@modules/agents/router/middlewares";

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

const threadIdInputSchema = z.object({ threadId: threadSchema.shape.id });

const createThreadInputSchema = insertThreadSchema
   .pick({ title: true })
   .extend({ title: z.string().min(1).max(200).optional() });

const updateThreadInputSchema = threadIdInputSchema.merge(
   insertThreadSchema
      .pick({ title: true })
      .extend({ title: z.string().min(1).max(200) }),
);

const listThreadsInputSchema = z
   .object({ limit: z.number().int().min(1).max(100).default(50) })
   .default({ limit: 50 });

const syncMessagesInputSchema = z.object({
   threadId: threadSchema.shape.id,
   messages: z.array(uiMessageSchema),
});

export const list = protectedProcedure
   .input(listThreadsInputSchema)
   .handler(async ({ context, input }) => {
      const rows = await context.db.query.threads.findMany({
         columns: {
            id: true,
            title: true,
            lastMessageAt: true,
            createdAt: true,
            updatedAt: true,
         },
         where: (fields, { and, eq }) =>
            and(
               eq(fields.teamId, context.teamId),
               eq(fields.userId, context.userId),
            ),
         orderBy: (fields, { desc }) => [
            desc(fields.lastMessageAt),
            desc(fields.createdAt),
         ],
         limit: input.limit,
      });
      return { threads: rows };
   });

export const getById = protectedProcedure
   .input(threadIdInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const rows = await context.db
         .select({
            id: messages.id,
            role: messages.role,
            parts: messages.parts,
         })
         .from(messages)
         .where(eq(messages.threadId, input.threadId))
         .orderBy(asc(messages.position));
      const uiMessages: UIMessage[] = rows.map((row) => ({
         id: row.id,
         role: row.role as UIMessage["role"],
         parts: row.parts,
      }));
      return { thread: context.thread, messages: uiMessages };
   });

export const create = protectedProcedure
   .input(createThreadInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction((tx) =>
            tx
               .insert(threads)
               .values({
                  teamId: context.teamId,
                  organizationId: context.organizationId,
                  userId: context.userId,
                  title: input.title ?? null,
               })
               .returning(),
         ),
         () => WebAppError.internal("Falha ao criar conversa."),
      ).andThen((rows) => {
         const row = rows[0];
         if (row === undefined) {
            return err(WebAppError.internal("Falha ao criar conversa."));
         }
         return ok(row);
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const update = protectedProcedure
   .input(updateThreadInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction((tx) =>
            tx
               .update(threads)
               .set({ title: input.title })
               .where(eq(threads.id, input.threadId))
               .returning(),
         ),
         () => WebAppError.internal("Falha ao atualizar conversa."),
      ).andThen((rows) => {
         const row = rows[0];
         if (row === undefined) {
            return err(WebAppError.internal("Falha ao atualizar conversa."));
         }
         return ok(row);
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const remove = protectedProcedure
   .input(threadIdInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction((tx) =>
            tx.delete(threads).where(eq(threads.id, input.threadId)),
         ),
         () => WebAppError.internal("Falha ao excluir conversa."),
      );
      if (result.isErr()) throw result.error;
      return { ok: true };
   });

export const removeBulk = protectedProcedure
   .input(
      z.object({
         threadIds: z.array(threadSchema.shape.id).min(1).max(100),
      }),
   )
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction((tx) =>
            tx
               .delete(threads)
               .where(
                  and(
                     eq(threads.teamId, context.teamId),
                     eq(threads.userId, context.userId),
                     inArray(threads.id, input.threadIds),
                  ),
               )
               .returning({ id: threads.id }),
         ),
         () => WebAppError.internal("Falha ao excluir conversas."),
      );
      if (result.isErr()) throw result.error;
      return { count: result.value.length };
   });

export const syncMessages = protectedProcedure
   .input(syncMessagesInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const rows = input.messages.map((m, position) => ({
         id: m.id,
         threadId: input.threadId,
         role: m.role,
         parts: m.parts,
         position,
      }));
      const result = await safeTry(async function* () {
         yield* fromPromise(
            context.db.transaction(async (tx) => {
               await tx
                  .delete(messages)
                  .where(eq(messages.threadId, input.threadId));
               if (rows.length > 0) await tx.insert(messages).values(rows);
               await tx
                  .update(threads)
                  .set({ lastMessageAt: dayjs().toDate() })
                  .where(eq(threads.id, input.threadId));
            }),
            () => WebAppError.internal("Falha ao sincronizar mensagens."),
         );
         return ok({ ok: true });
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const updateTitle = protectedProcedure
   .input(threadIdInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const recent = await context.db
         .select({ role: messages.role, parts: messages.parts })
         .from(messages)
         .where(eq(messages.threadId, input.threadId))
         .orderBy(asc(messages.position))
         .limit(4);

      const result = await fromPromise(
         chat({
            adapter: flashModel,
            messages: [
               {
                  role: "user",
                  content: [
                     {
                        type: "text",
                        content: `Gere um título curto em pt-BR para esta conversa da Montte AI.

Regras:
- Máximo 6 palavras.
- Sem aspas.
- Sem pontuação final.
- Foque no pedido principal do usuário.

Mensagens:
${JSON.stringify(recent)}`,
                     },
                  ],
               },
            ],
            stream: false,
         }),
         () => WebAppError.internal("Falha ao gerar título da conversa."),
      )
         .map((title) => title.trim().slice(0, 80))
         .andThen((title) => {
            if (title.length === 0) {
               return err(
                  WebAppError.internal("Falha ao gerar título da conversa."),
               );
            }
            return ok(title);
         })
         .andThen((title) =>
            fromPromise(
               context.db.transaction((tx) =>
                  tx
                     .update(threads)
                     .set({ title })
                     .where(eq(threads.id, input.threadId))
                     .returning(),
               ),
               () => WebAppError.internal("Falha ao atualizar título."),
            ),
         )
         .andThen((rows) => {
            const row = rows[0];
            if (row === undefined) {
               return err(WebAppError.internal("Falha ao atualizar título."));
            }
            return ok(row);
         });
      if (result.isErr()) throw result.error;
      return result.value;
   });
