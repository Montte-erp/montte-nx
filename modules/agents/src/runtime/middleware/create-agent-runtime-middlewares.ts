import type { ChatMiddleware, UIMessage } from "@tanstack/ai";
import dayjs from "dayjs";
import { defineErrorCatalog } from "evlog";
import { Result, TaggedError, type Result as ResultType } from "better-result";
import { and, eq, isNull } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   messageMetadataSchema,
   messages,
   type MessageMetadata,
} from "@core/database/schemas/messages";
import { threads } from "@core/database/schemas/threads";
import { log } from "@core/logging";
import type { PgBossClient } from "@core/pg-boss/client";
import {
   enqueueGenerateThreadTitleJob,
   type GenerateThreadTitleJobError,
} from "@modules/agents/jobs/generate-title-job";
import {
   enqueueRefreshThreadSuggestionsJob,
   type RefreshThreadSuggestionsJobError,
} from "@modules/agents/jobs/refresh-suggestions-job";
import { createAssistantStreamState } from "./assistant-stream-state";

const runtimeErrors = defineErrorCatalog("agents.runtime", {
   ASSISTANT_MESSAGE_PERSIST_FAILED: {
      status: 500,
      message: "Falha ao salvar resposta da conversa.",
      why: "A persistência da resposta emitida pelo stream falhou.",
      fix: "Tente enviar a mensagem novamente.",
      tags: ["agents", "runtime", "database"],
   },
   THREAD_TITLE_CHECK_FAILED: {
      status: 500,
      message: "Falha ao verificar conversa para título.",
      why: "A consulta que decide se o título deve ser gerado falhou.",
      fix: "O título pode ser gerado em uma próxima resposta.",
      tags: ["agents", "runtime", "pg-boss"],
   },
   THREAD_TITLE_ENQUEUE_FAILED: {
      status: 500,
      message: "Falha ao enfileirar geração de título.",
      why: "O pg-boss não aceitou o job de título.",
      fix: "O título pode ser gerado em uma próxima resposta.",
      tags: ["agents", "runtime", "pg-boss"],
   },
   THREAD_SUGGESTIONS_ENQUEUE_FAILED: {
      status: 500,
      message: "Falha ao enfileirar sugestões da conversa.",
      why: "O pg-boss não aceitou o job de sugestões.",
      fix: "As sugestões podem ser atualizadas em uma próxima resposta.",
      tags: ["agents", "runtime", "pg-boss"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "agents.runtime": typeof runtimeErrors;
   }
}

type AgentRuntimeCatalogError =
   | ReturnType<typeof runtimeErrors.ASSISTANT_MESSAGE_PERSIST_FAILED>
   | ReturnType<typeof runtimeErrors.THREAD_TITLE_CHECK_FAILED>
   | ReturnType<typeof runtimeErrors.THREAD_TITLE_ENQUEUE_FAILED>
   | ReturnType<typeof runtimeErrors.THREAD_SUGGESTIONS_ENQUEUE_FAILED>;

class AgentRuntimeError extends TaggedError("AgentRuntimeError")<{
   error: AgentRuntimeCatalogError;
   threadId: string;
   teamId?: string;
   organizationId?: string;
   messageCount?: number;
   jobError?: GenerateThreadTitleJobError | RefreshThreadSuggestionsJobError;
}>() {}

const MIN_TITLE_MESSAGE_COUNT = 2;
const MIN_SUGGESTION_MESSAGE_COUNT = 4;
const SUGGESTION_MESSAGE_INTERVAL = 4;

export interface AgentRuntimeMiddlewareDeps {
   db: DatabaseInstance;
   pgBoss: Promise<PgBossClient>;
   threadId: string;
   teamId: string;
   organizationId: string;
   history: UIMessage[];
}

export function createAgentRuntimeMiddlewares(
   deps: AgentRuntimeMiddlewareDeps,
) {
   const streamState = createAssistantStreamState(deps.history);

   return [
      {
         name: "agent-runtime-state",
         onStart() {
            streamState.onStart();
         },
         onChunk(_ctx, chunk) {
            streamState.processChunk(chunk);
         },
         async onFinish(ctx) {
            const persist = await persistAssistantMessages({
               db: deps.db,
               threadId: deps.threadId,
               teamId: deps.teamId,
               organizationId: deps.organizationId,
               streamState,
            });
            if (Result.isError(persist)) {
               throw persist.error;
            }

            const messageCount = streamState.messageCount();
            if (messageCount >= MIN_TITLE_MESSAGE_COUNT) {
               ctx.defer(
                  enqueueThreadTitle({
                     db: deps.db,
                     pgBoss: deps.pgBoss,
                     threadId: deps.threadId,
                     teamId: deps.teamId,
                     organizationId: deps.organizationId,
                  }).then((result) => {
                     if (!Result.isError(result)) return;
                     log.error({
                        module: "agents.runtime",
                        message: "failed enqueue generate-title",
                        err: result.error,
                     });
                  }),
               );
            }

            if (
               messageCount >= MIN_SUGGESTION_MESSAGE_COUNT &&
               messageCount % SUGGESTION_MESSAGE_INTERVAL === 0
            ) {
               ctx.defer(
                  enqueueThreadSuggestions({
                     pgBoss: deps.pgBoss,
                     threadId: deps.threadId,
                     teamId: deps.teamId,
                     organizationId: deps.organizationId,
                     messageCount,
                  }).then((result) => {
                     if (!Result.isError(result)) return;
                     log.error({
                        module: "agents.runtime",
                        message: "failed enqueue refresh-suggestions",
                        err: result.error,
                     });
                  }),
               );
            }
         },
      } satisfies ChatMiddleware,
   ];
}

async function persistAssistantMessages(options: {
   db: DatabaseInstance;
   threadId: string;
   teamId: string;
   organizationId: string;
   streamState: ReturnType<typeof createAssistantStreamState>;
}): Promise<ResultType<void, AgentRuntimeError>> {
   const newAssistantMessages = options.streamState.newAssistantMessages();

   if (newAssistantMessages.length === 0) {
      log.warn({
         module: "agents.runtime",
         message: "agent chat produced no assistant parts",
         threadId: options.threadId,
      });
      return Result.ok(undefined);
   }

   const result = await Result.tryPromise({
      try: () =>
         options.db.transaction(async (tx) => {
            for (const msg of newAssistantMessages) {
               const metadata: MessageMetadata = messageMetadataSchema.parse({
                  ...(options.streamState.traceId() && {
                     traceId: options.streamState.traceId(),
                  }),
               });
               await tx.insert(messages).values({
                  threadId: options.threadId,
                  role: "assistant",
                  parts: msg.parts,
                  metadata,
               });
            }
            await tx
               .update(threads)
               .set({ lastMessageAt: dayjs().toDate() })
               .where(
                  and(
                     eq(threads.id, options.threadId),
                     eq(threads.teamId, options.teamId),
                     eq(threads.organizationId, options.organizationId),
                  ),
               );
         }),
      catch: () =>
         new AgentRuntimeError({
            error: runtimeErrors.ASSISTANT_MESSAGE_PERSIST_FAILED({
               internal: { threadId: options.threadId },
            }),
            threadId: options.threadId,
         }),
   });
   if (Result.isError(result)) return Result.err(result.error);
   return Result.ok(undefined);
}

async function enqueueThreadTitle(options: {
   db: DatabaseInstance;
   pgBoss: Promise<PgBossClient>;
   threadId: string;
   teamId: string;
   organizationId: string;
}): Promise<ResultType<string | undefined, AgentRuntimeError>> {
   const threadResult = await Result.tryPromise({
      try: () =>
         options.db
            .select({ title: threads.title })
            .from(threads)
            .where(
               and(
                  eq(threads.id, options.threadId),
                  eq(threads.teamId, options.teamId),
                  eq(threads.organizationId, options.organizationId),
                  isNull(threads.title),
               ),
            )
            .limit(1),
      catch: () =>
         new AgentRuntimeError({
            error: runtimeErrors.THREAD_TITLE_CHECK_FAILED({
               internal: {
                  threadId: options.threadId,
                  teamId: options.teamId,
                  organizationId: options.organizationId,
               },
            }),
            threadId: options.threadId,
            teamId: options.teamId,
            organizationId: options.organizationId,
         }),
   });
   if (Result.isError(threadResult)) return Result.err(threadResult.error);
   if (!threadResult.value[0]) return Result.ok(undefined);

   const bossResult = await Result.tryPromise({
      try: () => options.pgBoss,
      catch: () =>
         new AgentRuntimeError({
            error: runtimeErrors.THREAD_TITLE_ENQUEUE_FAILED({
               internal: {
                  threadId: options.threadId,
                  teamId: options.teamId,
                  organizationId: options.organizationId,
               },
            }),
            threadId: options.threadId,
            teamId: options.teamId,
            organizationId: options.organizationId,
         }),
   });
   if (Result.isError(bossResult)) return Result.err(bossResult.error);

   const result = await enqueueGenerateThreadTitleJob({
      boss: bossResult.value,
      input: {
         threadId: options.threadId,
         teamId: options.teamId,
         organizationId: options.organizationId,
      },
   });
   if (Result.isError(result)) {
      return Result.err(
         new AgentRuntimeError({
            error: runtimeErrors.THREAD_TITLE_ENQUEUE_FAILED({
               internal: {
                  threadId: options.threadId,
                  teamId: options.teamId,
                  organizationId: options.organizationId,
               },
            }),
            threadId: options.threadId,
            teamId: options.teamId,
            organizationId: options.organizationId,
            jobError: result.error,
         }),
      );
   }
   return Result.ok(result.value);
}

async function enqueueThreadSuggestions(options: {
   pgBoss: Promise<PgBossClient>;
   threadId: string;
   teamId: string;
   organizationId: string;
   messageCount: number;
}): Promise<ResultType<string, AgentRuntimeError>> {
   const bossResult = await Result.tryPromise({
      try: () => options.pgBoss,
      catch: () =>
         new AgentRuntimeError({
            error: runtimeErrors.THREAD_SUGGESTIONS_ENQUEUE_FAILED({
               internal: {
                  threadId: options.threadId,
                  teamId: options.teamId,
                  organizationId: options.organizationId,
                  messageCount: options.messageCount,
               },
            }),
            threadId: options.threadId,
            teamId: options.teamId,
            organizationId: options.organizationId,
            messageCount: options.messageCount,
         }),
   });
   if (Result.isError(bossResult)) return Result.err(bossResult.error);

   const result = await enqueueRefreshThreadSuggestionsJob({
      boss: bossResult.value,
      input: {
         threadId: options.threadId,
         teamId: options.teamId,
         organizationId: options.organizationId,
         messageCount: options.messageCount,
      },
   });
   if (Result.isError(result)) {
      return Result.err(
         new AgentRuntimeError({
            error: runtimeErrors.THREAD_SUGGESTIONS_ENQUEUE_FAILED({
               internal: {
                  threadId: options.threadId,
                  teamId: options.teamId,
                  organizationId: options.organizationId,
                  messageCount: options.messageCount,
               },
            }),
            threadId: options.threadId,
            teamId: options.teamId,
            organizationId: options.organizationId,
            messageCount: options.messageCount,
            jobError: result.error,
         }),
      );
   }
   return Result.ok(result.value);
}
