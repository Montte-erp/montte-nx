import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { err, fromPromise, ok, safeTry } from "neverthrow";
import { z } from "zod";
import {
   insertThreadMessageSchema,
   insertThreadSchema,
   threadMessages,
   threads,
   threadSchema,
} from "@core/database/schemas/threads";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   requireThread,
   withNextThreadMessageSequence,
} from "@modules/agents/router/middlewares";

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

const messagePartSchema = z.object({ type: z.string() }).passthrough();

const appendMessageInputSchema = insertThreadMessageSchema
   .pick({ id: true, role: true, toolCallId: true })
   .extend({
      threadId: z.string().uuid(),
      parts: z.array(messagePartSchema),
   });

const listMessagesInputSchema = threadIdInputSchema;

const syncMessageSchema = insertThreadMessageSchema
   .pick({ role: true })
   .extend({ parts: z.array(messagePartSchema) });

const syncMessagesInputSchema = z.object({
   threadId: z.string().uuid(),
   messages: z.array(syncMessageSchema),
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

export const create = protectedProcedure
   .input(createThreadInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db
            .insert(threads)
            .values({
               teamId: context.teamId,
               organizationId: context.organizationId,
               userId: context.userId,
               title: input.title ?? null,
            })
            .returning(),
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
         context.db
            .update(threads)
            .set({ title: input.title })
            .where(eq(threads.id, input.threadId))
            .returning(),
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
         context.db.delete(threads).where(eq(threads.id, input.threadId)),
         () => WebAppError.internal("Falha ao excluir conversa."),
      );
      if (result.isErr()) throw result.error;
      return { ok: true };
   });

export const messages = protectedProcedure
   .input(listMessagesInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const rows = await context.db.query.threadMessages.findMany({
         where: (fields, { eq }) => eq(fields.threadId, input.threadId),
         orderBy: (fields, { asc }) => [asc(fields.sequence)],
      });
      return { messages: rows };
   });

export const appendMessage = protectedProcedure
   .input(appendMessageInputSchema)
   .use(requireThread, (input) => input.threadId)
   .use(withNextThreadMessageSequence, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const result = await safeTry(async function* () {
         const message = yield* fromPromise(
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .insert(threadMessages)
                  .values({
                     id: input.id,
                     threadId: input.threadId,
                     sequence: context.nextThreadMessageSequence,
                     role: input.role,
                     parts: input.parts,
                     toolCallId: input.toolCallId,
                  })
                  .returning();
               await tx
                  .update(threads)
                  .set({ lastMessageAt: dayjs().toDate() })
                  .where(eq(threads.id, input.threadId));
               return row;
            }),
            () => WebAppError.internal("Falha ao salvar mensagem."),
         );
         if (message === undefined) {
            return err(WebAppError.internal("Falha ao salvar mensagem."));
         }
         return ok(message);
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const syncMessages = protectedProcedure
   .input(syncMessagesInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const result = await safeTry(async function* () {
         yield* fromPromise(
            context.db.transaction(async (tx) => {
               await tx
                  .delete(threadMessages)
                  .where(eq(threadMessages.threadId, input.threadId));
               if (input.messages.length > 0) {
                  await tx.insert(threadMessages).values(
                     input.messages.map((message, index) => ({
                        threadId: input.threadId,
                        sequence: index,
                        role: message.role,
                        parts: message.parts,
                     })),
                  );
               }
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
