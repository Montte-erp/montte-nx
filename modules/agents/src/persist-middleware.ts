import { StreamProcessor, type UIMessage } from "@tanstack/ai";
import type { ChatMiddleware } from "@tanstack/ai";
import { Result, TaggedError } from "better-result";
import dayjs from "dayjs";
import { and, eq, isNull } from "drizzle-orm";
import {
   messageMetadataSchema,
   messages,
   type MessageMetadata,
} from "@core/database/schemas/messages";
import { threads } from "@core/database/schemas/threads";
import type { DatabaseInstance } from "@core/database/client";
import type { WorkflowClient } from "@core/dbos/client";
import type { PgBossClient } from "@core/pg-boss/client";
import type { Redis } from "@core/redis/connection";
import { log } from "@core/logging";
import { agentsSseEvents } from "@modules/agents/sse";
import { enqueueGenerateThreadTitleJob } from "@modules/agents/jobs/generate-title-job";
import { enqueueRefreshSuggestions } from "@modules/agents/workflows/refresh-suggestions-workflow";

const MIN_TITLE_MESSAGE_COUNT = 2;
const MIN_SUGGESTION_MESSAGE_COUNT = 4;
const SUGGESTION_MESSAGE_INTERVAL = 4;

class PersistMiddlewareError extends TaggedError("PersistMiddlewareError")<{
   operation: "enqueue_title" | "enqueue_suggestions" | "publish_persisted";
   message: string;
   threadId: string;
   teamId: string;
   organizationId: string;
   cause?: unknown;
}>() {}

export interface PersistMiddlewareDeps {
   db: DatabaseInstance;
   pgBoss: Promise<PgBossClient>;
   redis: Redis;
   workflowClient: WorkflowClient;
   threadId: string;
   teamId: string;
   organizationId: string;
   history: UIMessage[];
}

export function createPersistMiddleware(
   deps: PersistMiddlewareDeps,
): ChatMiddleware {
   const processor = new StreamProcessor();
   let traceId: string | undefined;

   return {
      name: "persist",
      onStart() {
         processor.setMessages(deps.history);
         processor.prepareAssistantMessage();
      },
      onChunk(_ctx, chunk) {
         if (chunk.type === "RUN_STARTED") traceId = chunk.runId;
         processor.processChunk(chunk);
      },
      async onFinish() {
         const newAssistantMessages = processor
            .getMessages()
            .slice(deps.history.length)
            .filter((m) => m.role === "assistant" && m.parts.length > 0);

         if (newAssistantMessages.length === 0) {
            log.warn({
               module: "agents.persist-middleware",
               message: "agent chat produced no assistant parts",
               threadId: deps.threadId,
            });
            return;
         }
         const messageCount = processor.getMessages().length;

         const inserted = await deps.db.transaction(async (tx) => {
            const rows: { id: string }[] = [];
            for (const msg of newAssistantMessages) {
               const metadata: MessageMetadata = messageMetadataSchema.parse({
                  ...(traceId && { traceId }),
               });
               const [row] = await tx
                  .insert(messages)
                  .values({
                     threadId: deps.threadId,
                     role: "assistant",
                     parts: msg.parts,
                     metadata,
                  })
                  .returning({ id: messages.id });
               if (row) rows.push(row);
            }
            await tx
               .update(threads)
               .set({ lastMessageAt: dayjs().toDate() })
               .where(eq(threads.id, deps.threadId));

            if (messageCount >= MIN_TITLE_MESSAGE_COUNT) {
               const [thread] = await tx
                  .select({ title: threads.title })
                  .from(threads)
                  .where(
                     and(
                        eq(threads.id, deps.threadId),
                        eq(threads.teamId, deps.teamId),
                        eq(threads.organizationId, deps.organizationId),
                        isNull(threads.title),
                     ),
                  )
                  .limit(1);
               if (thread) {
                  const enqueueTitle = await enqueueThreadTitle({
                     deps,
                     tx,
                  });
                  if (Result.isError(enqueueTitle)) {
                     log.error({
                        module: "agents.persist-middleware",
                        message: "failed enqueue generate-title",
                        err: enqueueTitle.error,
                     });
                  }
               }
            }

            return rows;
         });

         if (
            messageCount >= MIN_SUGGESTION_MESSAGE_COUNT &&
            messageCount % SUGGESTION_MESSAGE_INTERVAL === 0
         ) {
            const enqueueSuggestions = await enqueueThreadSuggestions({
               deps,
               messageCount,
            });
            if (Result.isError(enqueueSuggestions)) {
               log.error({
                  module: "agents.persist-middleware",
                  message: "failed enqueue refresh-suggestions",
                  err: enqueueSuggestions.error,
               });
            }
         }

         const assistantRow = inserted.at(-1);
         if (assistantRow) {
            const publishPersisted = await publishAssistantPersisted({
               deps,
               messageId: assistantRow.id,
            });
            if (Result.isError(publishPersisted)) {
               log.error({
                  module: "agents.persist-middleware",
                  message: "failed publish SSE persisted",
                  err: publishPersisted.error,
               });
            }
         }
      },
   };
}

async function enqueueThreadTitle(options: {
   deps: PersistMiddlewareDeps;
   tx: Parameters<typeof enqueueGenerateThreadTitleJob>[0]["tx"];
}) {
   const { deps, tx } = options;
   const result = await Result.tryPromise({
      try: async () => {
         const boss = await deps.pgBoss;
         return enqueueGenerateThreadTitleJob({
            boss,
            tx,
            input: {
               threadId: deps.threadId,
               teamId: deps.teamId,
               organizationId: deps.organizationId,
            },
         });
      },
      catch: (cause) =>
         new PersistMiddlewareError({
            operation: "enqueue_title",
            message: "Falha ao enfileirar geração de título.",
            threadId: deps.threadId,
            teamId: deps.teamId,
            organizationId: deps.organizationId,
            cause,
         }),
   });
   if (Result.isError(result)) return Result.err(result.error);
   if (Result.isError(result.value)) {
      return Result.err(
         new PersistMiddlewareError({
            operation: "enqueue_title",
            message: result.value.error.message,
            threadId: deps.threadId,
            teamId: deps.teamId,
            organizationId: deps.organizationId,
            cause: result.value.error,
         }),
      );
   }
   return Result.ok(result.value.value);
}

function enqueueThreadSuggestions(options: {
   deps: PersistMiddlewareDeps;
   messageCount: number;
}) {
   const { deps, messageCount } = options;
   return Result.tryPromise({
      try: () =>
         enqueueRefreshSuggestions(deps.workflowClient, {
            threadId: deps.threadId,
            teamId: deps.teamId,
            organizationId: deps.organizationId,
            messageCount,
         }),
      catch: (cause) =>
         new PersistMiddlewareError({
            operation: "enqueue_suggestions",
            message: "Falha ao enfileirar sugestões da conversa.",
            threadId: deps.threadId,
            teamId: deps.teamId,
            organizationId: deps.organizationId,
            cause,
         }),
   });
}

async function publishAssistantPersisted(options: {
   deps: PersistMiddlewareDeps;
   messageId: string;
}) {
   const { deps, messageId } = options;
   const publish = await agentsSseEvents.publish(
      deps.redis,
      { kind: "team", id: deps.teamId },
      {
         type: "agent.message.persisted",
         payload: {
            threadId: deps.threadId,
            messageId,
            role: "assistant",
         },
      },
   );
   if (publish.isErr()) {
      return Result.err(
         new PersistMiddlewareError({
            operation: "publish_persisted",
            message: "Falha ao publicar mensagem persistida.",
            threadId: deps.threadId,
            teamId: deps.teamId,
            organizationId: deps.organizationId,
            cause: publish.error,
         }),
      );
   }
   return Result.ok(undefined);
}
