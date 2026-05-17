import { and, asc, eq, inArray } from "drizzle-orm";
import dayjs from "dayjs";
import { err, fromPromise, ok } from "neverthrow";
import { z } from "zod";
import type { UIMessage } from "@tanstack/ai";
import { messages } from "@core/database/schemas/messages";
import {
   insertThreadSchema,
   threads,
   threadSchema,
} from "@core/database/schemas/threads";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { requireThread } from "@modules/agents/router/middlewares";

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

const contentPartSourceSchema = z.discriminatedUnion("type", [
   z.object({
      type: z.literal("data"),
      value: z.string(),
      mimeType: z.string(),
   }),
   z.object({
      type: z.literal("url"),
      value: z.string(),
      mimeType: z.string().optional(),
   }),
]);

const messagePartSchema = z.discriminatedUnion("type", [
   z.object({ type: z.literal("text"), content: z.string() }),
   z.object({
      type: z.literal("image"),
      source: contentPartSourceSchema,
      metadata: z.unknown().optional(),
   }),
   z.object({
      type: z.literal("audio"),
      source: contentPartSourceSchema,
      metadata: z.unknown().optional(),
   }),
   z.object({
      type: z.literal("video"),
      source: contentPartSourceSchema,
      metadata: z.unknown().optional(),
   }),
   z.object({
      type: z.literal("document"),
      source: contentPartSourceSchema,
      metadata: z.unknown().optional(),
   }),
   z.object({ type: z.literal("thinking"), content: z.string() }),
   z.object({
      type: z.literal("tool-call"),
      id: z.string().min(1),
      name: z.string().min(1),
      arguments: z.string(),
      state: z.enum([
         "awaiting-input",
         "input-streaming",
         "input-complete",
         "approval-requested",
         "approval-responded",
      ]),
      approval: z
         .object({
            id: z.string().min(1),
            needsApproval: z.boolean(),
            approved: z.boolean().optional(),
         })
         .optional(),
      output: z.unknown().optional(),
   }),
   z.object({
      type: z.literal("tool-result"),
      toolCallId: z.string().min(1),
      content: z.string(),
      state: z.enum(["streaming", "complete", "error"]),
      error: z.string().optional(),
   }),
]);

const messagePartsSchema = z
   .array(messagePartSchema)
   .min(1) satisfies z.ZodType<UIMessage["parts"]>;

const saveAssistantMessageInputSchema = threadIdInputSchema.extend({
   parts: messagePartsSchema,
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
         where: (fields, { and: andFn, eq: eqFn }) =>
            andFn(
               eqFn(fields.teamId, context.teamId),
               eqFn(fields.userId, context.userId),
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
            metadata: messages.metadata,
            createdAt: messages.createdAt,
         })
         .from(messages)
         .where(eq(messages.threadId, input.threadId))
         .orderBy(asc(messages.createdAt));
      return {
         thread: context.thread,
         messages: rows.map((row) => ({
            id: row.id,
            role: row.role,
            parts: row.parts,
            metadata: row.metadata,
            threadId: input.threadId,
            createdAt: row.createdAt.toISOString(),
         })),
      };
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

export const removeMessage = protectedProcedure
   .input(
      z.object({
         threadId: z.string().uuid(),
         messageId: z.string().uuid(),
      }),
   )
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction((tx) =>
            tx
               .delete(messages)
               .where(
                  and(
                     eq(messages.id, input.messageId),
                     eq(messages.threadId, input.threadId),
                  ),
               ),
         ),
         () => WebAppError.internal("Falha ao excluir mensagem."),
      );
      if (result.isErr()) throw result.error;
      return { ok: true };
   });

export const saveAssistantMessage = protectedProcedure
   .input(saveAssistantMessageInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const rows = await tx
               .insert(messages)
               .values({
                  threadId: input.threadId,
                  role: "assistant",
                  parts: input.parts,
               })
               .returning({ id: messages.id });
            await tx
               .update(threads)
               .set({ lastMessageAt: dayjs().toDate() })
               .where(eq(threads.id, input.threadId));
            return rows;
         }),
         () => WebAppError.internal("Falha ao salvar resposta da conversa."),
      ).andThen((rows) => {
         const row = rows[0];
         if (row === undefined) {
            return err(
               WebAppError.internal("Falha ao salvar resposta da conversa."),
            );
         }
         return ok(row);
      });
      if (result.isErr()) throw result.error;
      return result.value;
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
