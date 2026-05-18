import { os } from "@orpc/server";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import dayjs from "dayjs";
import { defineErrorCatalog } from "evlog";
import { Result, TaggedError } from "better-result";
import type { UIMessage } from "@tanstack/ai";
import { z } from "zod";
import {
   messagePageContextSchema,
   messages,
} from "@core/database/schemas/messages";
import {
   insertThreadSchema,
   threads,
   threadSchema,
} from "@core/database/schemas/threads";
import { log } from "@core/logging";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { protectedProcedure } from "@core/orpc/server";
import { createAgentChat } from "@modules/agents/agent";
import { createAgentRuntimeMiddlewares } from "@modules/agents/runtime/middleware/create-agent-runtime-middlewares";

export const threadErrors = defineErrorCatalog("agents.thread", {
   THREAD_LOOKUP_FAILED: {
      status: 500,
      message: "Falha ao verificar conversa.",
      why: "A consulta de permissão da conversa falhou.",
      fix: "Tente novamente. Se persistir, acione o suporte.",
      tags: ["agents", "thread", "database"],
   },
   THREAD_NOT_FOUND: {
      status: 404,
      message: "Conversa não encontrada.",
      why: "A conversa não existe ou não pertence ao escopo atual.",
      fix: "Recarregue a página e selecione uma conversa válida.",
      tags: ["agents", "thread", "permission"],
   },
   THREAD_CREATE_FAILED: {
      status: 500,
      message: "Falha ao criar conversa.",
      why: "A gravação da conversa falhou.",
      fix: "Tente iniciar a conversa novamente.",
      tags: ["agents", "thread", "database"],
   },
   THREAD_CREATE_EMPTY_RESULT: {
      status: 500,
      message: "Falha ao criar conversa.",
      why: "O banco confirmou a operação, mas não retornou a conversa criada.",
      fix: "Tente iniciar a conversa novamente.",
      tags: ["agents", "thread", "database"],
   },
   THREAD_UPDATE_FAILED: {
      status: 500,
      message: "Falha ao atualizar conversa.",
      why: "A atualização da conversa falhou.",
      fix: "Tente renomear a conversa novamente.",
      tags: ["agents", "thread", "database"],
   },
   THREAD_UPDATE_EMPTY_RESULT: {
      status: 500,
      message: "Falha ao atualizar conversa.",
      why: "O banco confirmou a operação, mas não retornou a conversa atualizada.",
      fix: "Recarregue a conversa antes de tentar novamente.",
      tags: ["agents", "thread", "database"],
   },
   THREAD_DELETE_FAILED: {
      status: 500,
      message: "Falha ao excluir conversa.",
      why: "A exclusão da conversa falhou.",
      fix: "Tente excluir novamente.",
      tags: ["agents", "thread", "database"],
   },
   THREADS_DELETE_FAILED: {
      status: 500,
      message: "Falha ao excluir conversas.",
      why: "A exclusão em lote de conversas falhou.",
      fix: "Tente excluir novamente.",
      tags: ["agents", "thread", "database"],
   },
   MESSAGE_DELETE_FAILED: {
      status: 500,
      message: "Falha ao excluir mensagem.",
      why: "A exclusão da mensagem falhou.",
      fix: "Tente excluir a mensagem novamente.",
      tags: ["agents", "message", "database"],
   },
   ASSISTANT_MESSAGE_SAVE_FAILED: {
      status: 500,
      message: "Falha ao salvar resposta da conversa.",
      why: "A persistência da resposta do agente falhou.",
      fix: "Tente enviar a mensagem novamente.",
      tags: ["agents", "message", "database"],
   },
   ASSISTANT_MESSAGE_SAVE_EMPTY_RESULT: {
      status: 500,
      message: "Falha ao salvar resposta da conversa.",
      why: "O banco confirmou a operação, mas não retornou a mensagem criada.",
      fix: "Tente enviar a mensagem novamente.",
      tags: ["agents", "message", "database"],
   },
   CHAT_HISTORY_LOAD_FAILED: {
      status: 500,
      message: "Falha ao carregar histórico da conversa.",
      why: "A preparação do histórico para o agente falhou.",
      fix: "Recarregue a conversa e tente novamente.",
      tags: ["agents", "chat", "database"],
   },
   CHAT_TARGET_MESSAGE_NOT_FOUND: {
      status: 404,
      message: "Mensagem não encontrada.",
      why: "A mensagem alvo para regeneração ou edição não existe nessa conversa.",
      fix: "Recarregue a conversa antes de tentar novamente.",
      tags: ["agents", "message", "permission"],
   },
   CHAT_REGENERATE_NO_USER_MESSAGE: {
      status: 400,
      message: "Não há mensagem para regenerar.",
      why: "A conversa ainda não possui mensagem do usuário para servir de base.",
      fix: "Envie uma mensagem antes de regenerar a resposta.",
      tags: ["agents", "chat", "message"],
   },
   CHAT_SETTINGS_LOAD_FAILED: {
      status: 500,
      message: "Falha ao carregar configurações do agente.",
      why: "A consulta das configurações do agente falhou.",
      fix: "Tente novamente.",
      tags: ["agents", "settings", "database"],
   },
   CHAT_STREAM_CREATE_FAILED: {
      status: 500,
      message: "Falha ao iniciar resposta do agente.",
      why: "A inicialização do stream do agente falhou.",
      fix: "Tente enviar a mensagem novamente.",
      tags: ["agents", "chat", "stream"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "agents.thread": typeof threadErrors;
   }
}

type ThreadCatalogError =
   | ReturnType<typeof threadErrors.THREAD_LOOKUP_FAILED>
   | ReturnType<typeof threadErrors.THREAD_NOT_FOUND>
   | ReturnType<typeof threadErrors.THREAD_CREATE_FAILED>
   | ReturnType<typeof threadErrors.THREAD_CREATE_EMPTY_RESULT>
   | ReturnType<typeof threadErrors.THREAD_UPDATE_FAILED>
   | ReturnType<typeof threadErrors.THREAD_UPDATE_EMPTY_RESULT>
   | ReturnType<typeof threadErrors.THREAD_DELETE_FAILED>
   | ReturnType<typeof threadErrors.THREADS_DELETE_FAILED>
   | ReturnType<typeof threadErrors.MESSAGE_DELETE_FAILED>
   | ReturnType<typeof threadErrors.ASSISTANT_MESSAGE_SAVE_FAILED>
   | ReturnType<typeof threadErrors.ASSISTANT_MESSAGE_SAVE_EMPTY_RESULT>
   | ReturnType<typeof threadErrors.CHAT_HISTORY_LOAD_FAILED>
   | ReturnType<typeof threadErrors.CHAT_TARGET_MESSAGE_NOT_FOUND>
   | ReturnType<typeof threadErrors.CHAT_REGENERATE_NO_USER_MESSAGE>
   | ReturnType<typeof threadErrors.CHAT_SETTINGS_LOAD_FAILED>
   | ReturnType<typeof threadErrors.CHAT_STREAM_CREATE_FAILED>;

class AgentThreadError extends TaggedError("AgentThreadError")<{
   error: ThreadCatalogError;
   message: string;
   threadId?: string;
   threadIds?: string[];
   messageId?: string;
}>() {}

const base = os.$context<ORPCContextWithOrganization>();

const requireThread = base.middleware(async ({ context, next }, id: string) => {
   const result = await Result.tryPromise({
      try: () =>
         context.db.query.threads.findFirst({
            where: (f, { eq: eqFn }) => eqFn(f.id, id),
         }),
      catch: () =>
         (() => {
            const error = threadErrors.THREAD_LOOKUP_FAILED({
               internal: { threadId: id },
            });
            return new AgentThreadError({
               error,
               message: error.message,
               threadId: id,
            });
         })(),
   });
   if (Result.isError(result)) throw result.error;
   const thread = result.value;
   if (thread === undefined) {
      throw new AgentThreadError({
         error: threadErrors.THREAD_NOT_FOUND({ internal: { threadId: id } }),
         message: threadErrors.THREAD_NOT_FOUND({ internal: { threadId: id } })
            .message,
         threadId: id,
      });
   }
   if (thread.teamId !== context.teamId) {
      throw new AgentThreadError({
         error: threadErrors.THREAD_NOT_FOUND({ internal: { threadId: id } }),
         message: threadErrors.THREAD_NOT_FOUND({ internal: { threadId: id } })
            .message,
         threadId: id,
      });
   }
   if (thread.organizationId !== context.organizationId) {
      throw new AgentThreadError({
         error: threadErrors.THREAD_NOT_FOUND({ internal: { threadId: id } }),
         message: threadErrors.THREAD_NOT_FOUND({ internal: { threadId: id } })
            .message,
         threadId: id,
      });
   }
   if (thread.userId !== context.userId) {
      throw new AgentThreadError({
         error: threadErrors.THREAD_NOT_FOUND({ internal: { threadId: id } }),
         message: threadErrors.THREAD_NOT_FOUND({ internal: { threadId: id } })
            .message,
         threadId: id,
      });
   }
   return next({ context: { thread } });
});

export const chatInputSchema = z.object({
   threadId: z.string().uuid(),
   text: z.string().min(1).max(50_000).optional(),
   replaceFromMessageId: z.string().uuid().optional(),
   regenerate: z.boolean().optional(),
   pageContext: messagePageContextSchema.optional(),
});

export type ChatInput = z.infer<typeof chatInputSchema>;

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

const jsonSchema = z.json();

const messagePartSchema = z.discriminatedUnion("type", [
   z.object({ type: z.literal("text"), content: z.string() }),
   z.object({
      type: z.literal("image"),
      source: contentPartSourceSchema,
      metadata: jsonSchema.optional(),
   }),
   z.object({
      type: z.literal("audio"),
      source: contentPartSourceSchema,
      metadata: jsonSchema.optional(),
   }),
   z.object({
      type: z.literal("video"),
      source: contentPartSourceSchema,
      metadata: jsonSchema.optional(),
   }),
   z.object({
      type: z.literal("document"),
      source: contentPartSourceSchema,
      metadata: jsonSchema.optional(),
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
      output: jsonSchema.optional(),
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

const defaultChatSettings = {
   reasoningEffort: "high",
} satisfies { reasoningEffort: "high" | "xhigh" };

const chatSettingsSchema = z
   .object({
      reasoningEffort: z.enum(["high", "xhigh"]).default("high"),
   })
   .default(() => defaultChatSettings);

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
      const result = await Result.tryPromise({
         try: () =>
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
         catch: () =>
            new AgentThreadError({
               error: threadErrors.THREAD_CREATE_FAILED(),
               message: threadErrors.THREAD_CREATE_FAILED().message,
            }),
      });
      if (Result.isError(result)) throw result.error;
      const row = result.value[0];
      if (row === undefined) {
         throw new AgentThreadError({
            error: threadErrors.THREAD_CREATE_EMPTY_RESULT(),
            message: threadErrors.THREAD_CREATE_EMPTY_RESULT().message,
         });
      }
      return row;
   });

export const update = protectedProcedure
   .input(updateThreadInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction((tx) =>
               tx
                  .update(threads)
                  .set({ title: input.title })
                  .where(eq(threads.id, input.threadId))
                  .returning(),
            ),
         catch: () =>
            new AgentThreadError({
               error: threadErrors.THREAD_UPDATE_FAILED({
                  internal: { threadId: input.threadId },
               }),
               message: threadErrors.THREAD_UPDATE_FAILED({
                  internal: { threadId: input.threadId },
               }).message,
               threadId: input.threadId,
            }),
      });
      if (Result.isError(result)) throw result.error;
      const row = result.value[0];
      if (row === undefined) {
         throw new AgentThreadError({
            error: threadErrors.THREAD_UPDATE_EMPTY_RESULT({
               internal: { threadId: input.threadId },
            }),
            message: threadErrors.THREAD_UPDATE_EMPTY_RESULT({
               internal: { threadId: input.threadId },
            }).message,
            threadId: input.threadId,
         });
      }
      return row;
   });

export const remove = protectedProcedure
   .input(threadIdInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction((tx) =>
               tx.delete(threads).where(eq(threads.id, input.threadId)),
            ),
         catch: () =>
            new AgentThreadError({
               error: threadErrors.THREAD_DELETE_FAILED({
                  internal: { threadId: input.threadId },
               }),
               message: threadErrors.THREAD_DELETE_FAILED({
                  internal: { threadId: input.threadId },
               }).message,
               threadId: input.threadId,
            }),
      });
      if (Result.isError(result)) throw result.error;
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
      const result = await Result.tryPromise({
         try: () =>
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
         catch: () =>
            new AgentThreadError({
               error: threadErrors.MESSAGE_DELETE_FAILED({
                  internal: {
                     threadId: input.threadId,
                     messageId: input.messageId,
                  },
               }),
               message: threadErrors.MESSAGE_DELETE_FAILED({
                  internal: {
                     threadId: input.threadId,
                     messageId: input.messageId,
                  },
               }).message,
               threadId: input.threadId,
               messageId: input.messageId,
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { ok: true };
   });

export const saveAssistantMessage = protectedProcedure
   .input(saveAssistantMessageInputSchema)
   .use(requireThread, (input) => input.threadId)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
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
         catch: () =>
            new AgentThreadError({
               error: threadErrors.ASSISTANT_MESSAGE_SAVE_FAILED({
                  internal: { threadId: input.threadId },
               }),
               message: threadErrors.ASSISTANT_MESSAGE_SAVE_FAILED({
                  internal: { threadId: input.threadId },
               }).message,
               threadId: input.threadId,
            }),
      });
      if (Result.isError(result)) throw result.error;
      const row = result.value[0];
      if (row === undefined) {
         throw new AgentThreadError({
            error: threadErrors.ASSISTANT_MESSAGE_SAVE_EMPTY_RESULT({
               internal: { threadId: input.threadId },
            }),
            message: threadErrors.ASSISTANT_MESSAGE_SAVE_EMPTY_RESULT({
               internal: { threadId: input.threadId },
            }).message,
            threadId: input.threadId,
         });
      }
      return row;
   });

export const removeBulk = protectedProcedure
   .input(
      z.object({
         threadIds: z.array(threadSchema.shape.id).min(1).max(100),
      }),
   )
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
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
         catch: () =>
            new AgentThreadError({
               error: threadErrors.THREADS_DELETE_FAILED({
                  internal: { threadIds: input.threadIds },
               }),
               message: threadErrors.THREADS_DELETE_FAILED({
                  internal: { threadIds: input.threadIds },
               }).message,
               threadIds: input.threadIds,
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { count: result.value.length };
   });

export async function createThreadChatStream(options: {
   context: ORPCContextWithOrganization;
   input: ChatInput;
   signal?: AbortSignal;
}) {
   const { context, input, signal } = options;
   const threadResult = await Result.tryPromise({
      try: () =>
         context.db.query.threads.findFirst({
            where: (f, { eq: eqFn }) => eqFn(f.id, input.threadId),
         }),
      catch: () =>
         new AgentThreadError({
            error: threadErrors.THREAD_LOOKUP_FAILED({
               internal: { threadId: input.threadId },
            }),
            message: threadErrors.THREAD_LOOKUP_FAILED({
               internal: { threadId: input.threadId },
            }).message,
            threadId: input.threadId,
         }),
   });
   if (Result.isError(threadResult)) throw threadResult.error;
   const thread = threadResult.value;
   if (
      !thread ||
      thread.teamId !== context.teamId ||
      thread.organizationId !== context.organizationId ||
      thread.userId !== context.userId
   ) {
      throw new AgentThreadError({
         error: threadErrors.THREAD_NOT_FOUND({
            internal: { threadId: input.threadId },
         }),
         message: threadErrors.THREAD_NOT_FOUND({
            internal: { threadId: input.threadId },
         }).message,
         threadId: input.threadId,
      });
   }

   log.info({
      module: "agents.chat",
      message: "agent chat send start",
      userId: context.userId,
      threadId: input.threadId,
   });

   const historyResult = await Result.tryPromise({
      try: () =>
         context.db.transaction(async (tx) => {
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
               if (!lastUser) return { reason: "regenerate_no_user" };
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
               if (!row) return { reason: "target_not_found" };
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
         }),
      catch: () =>
         new AgentThreadError({
            error: threadErrors.CHAT_HISTORY_LOAD_FAILED({
               internal: { threadId: input.threadId },
            }),
            message: threadErrors.CHAT_HISTORY_LOAD_FAILED({
               internal: { threadId: input.threadId },
            }).message,
            threadId: input.threadId,
         }),
   });
   if (Result.isError(historyResult)) throw historyResult.error;
   if ("reason" in historyResult.value) {
      if (historyResult.value.reason === "regenerate_no_user") {
         throw new AgentThreadError({
            error: threadErrors.CHAT_REGENERATE_NO_USER_MESSAGE({
               internal: { threadId: input.threadId },
            }),
            message: threadErrors.CHAT_REGENERATE_NO_USER_MESSAGE({
               internal: { threadId: input.threadId },
            }).message,
            threadId: input.threadId,
         });
      }
      throw new AgentThreadError({
         error: threadErrors.CHAT_TARGET_MESSAGE_NOT_FOUND({
            internal: {
               threadId: input.threadId,
               messageId: input.replaceFromMessageId,
            },
         }),
         message: threadErrors.CHAT_TARGET_MESSAGE_NOT_FOUND({
            internal: {
               threadId: input.threadId,
               messageId: input.replaceFromMessageId,
            },
         }).message,
         threadId: input.threadId,
         messageId: input.replaceFromMessageId,
      });
   }
   const historyRows = historyResult.value;
   const history: UIMessage[] = historyRows.map((row) => ({
      id: row.id,
      role: row.role,
      parts: row.parts,
   }));

   const settingsResult = await Result.tryPromise({
      try: () =>
         context.db.query.agentSettings.findFirst({
            where: (f, { eq: eqFn }) => eqFn(f.teamId, context.teamId),
         }),
      catch: () =>
         new AgentThreadError({
            error: threadErrors.CHAT_SETTINGS_LOAD_FAILED({
               internal: { threadId: input.threadId },
            }),
            message: threadErrors.CHAT_SETTINGS_LOAD_FAILED({
               internal: { threadId: input.threadId },
            }).message,
            threadId: input.threadId,
         }),
   });
   if (Result.isError(settingsResult)) throw settingsResult.error;
   const chatSettings = chatSettingsSchema.parse(settingsResult.value);

   const abortController = new AbortController();
   signal?.addEventListener("abort", () => abortController.abort(), {
      once: true,
   });

   const streamResult = await Result.tryPromise({
      try: () =>
         createAgentChat({
            prompts: context.posthogPrompts,
            userId: context.userId,
            organizationId: context.organizationId,
            teamId: context.teamId,
            headers: context.headers,
            request: context.request,
            threadId: input.threadId,
            messages: history,
            pageContext: input.pageContext,
            reasoningEffort: chatSettings.reasoningEffort,
            abortSignal: abortController.signal,
            extraMiddleware: createAgentRuntimeMiddlewares({
               db: context.db,
               pgBoss: context.pgBoss,
               threadId: input.threadId,
               teamId: context.teamId,
               organizationId: context.organizationId,
               history,
            }),
         }),
      catch: () =>
         new AgentThreadError({
            error: threadErrors.CHAT_STREAM_CREATE_FAILED({
               internal: { threadId: input.threadId },
            }),
            message: threadErrors.CHAT_STREAM_CREATE_FAILED({
               internal: { threadId: input.threadId },
            }).message,
            threadId: input.threadId,
         }),
   });
   if (Result.isError(streamResult)) throw streamResult.error;

   return streamResult.value;
}

export const chat = protectedProcedure
   .input(chatInputSchema)
   .handler(createThreadChatStream);
