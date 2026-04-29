import dayjs from "dayjs";
import { and, asc, desc, eq, max } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { threadMessages, threads } from "@core/database/schemas/threads";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   appendMessageInputSchema,
   createThreadInputSchema,
   listMessagesInputSchema,
   listThreadsInputSchema,
   threadIdInputSchema,
   updateThreadInputSchema,
} from "../contracts/threads";
import { requireThread } from "./middlewares";

export const list = protectedProcedure
   .input(listThreadsInputSchema)
   .handler(async ({ context, input }) => {
      const limit = input?.limit ?? 50;
      const rows = await context.db
         .select({
            id: threads.id,
            title: threads.title,
            lastMessageAt: threads.lastMessageAt,
            createdAt: threads.createdAt,
            updatedAt: threads.updatedAt,
         })
         .from(threads)
         .where(
            and(
               eq(threads.teamId, context.teamId),
               eq(threads.userId, context.userId),
            ),
         )
         .orderBy(desc(threads.lastMessageAt), desc(threads.createdAt))
         .limit(limit);
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
      );
      if (result.isErr()) throw result.error;
      const [row] = result.value;
      if (!row) throw WebAppError.internal("Falha ao criar conversa.");
      return row;
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
      );
      if (result.isErr()) throw result.error;
      const [row] = result.value;
      if (!row) throw WebAppError.internal("Falha ao atualizar conversa.");
      return row;
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
      const rows = await context.db
         .select()
         .from(threadMessages)
         .where(eq(threadMessages.threadId, input.threadId))
         .orderBy(asc(threadMessages.sequence));
      return { messages: rows };
   });

export const appendMessage = protectedProcedure
   .input(appendMessageInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const seqRows = await tx
               .select({ next: max(threadMessages.sequence) })
               .from(threadMessages)
               .where(eq(threadMessages.threadId, input.threadId));
            const sequence = (seqRows[0]?.next ?? -1) + 1;
            const inserted = await tx
               .insert(threadMessages)
               .values({
                  id: input.id,
                  threadId: input.threadId,
                  sequence,
                  role: input.role,
                  parts: input.parts,
                  toolCallId: input.toolCallId ?? null,
               })
               .returning();
            await tx
               .update(threads)
               .set({ lastMessageAt: dayjs().toDate() })
               .where(eq(threads.id, input.threadId));
            return inserted[0];
         }),
         () => WebAppError.internal("Falha ao salvar mensagem."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao salvar mensagem.");
      return result.value;
   });
