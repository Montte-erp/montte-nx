import { StreamProcessor, type UIMessage } from "@tanstack/ai";
import type { ChatMiddleware } from "@tanstack/ai";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import {
   messageMetadataSchema,
   messages,
   type MessageMetadata,
} from "@core/database/schemas/messages";
import { threads } from "@core/database/schemas/threads";
import type { DatabaseInstance } from "@core/database/client";
import type { Redis } from "@core/redis/connection";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { log } from "@core/logging";
import { agentsSseEvents } from "@modules/agents/sse";
import { enqueueGenerateThreadTitle } from "@modules/agents/workflows/generate-title-workflow";
import { enqueueRefreshSuggestions } from "@modules/agents/workflows/refresh-suggestions-workflow";

const MIN_TITLE_MESSAGE_COUNT = 2;
const MIN_SUGGESTION_MESSAGE_COUNT = 4;
const SUGGESTION_MESSAGE_INTERVAL = 4;

export interface PersistMiddlewareDeps {
   db: DatabaseInstance;
   redis: Redis;
   workflowClient: DBOSClient;
   threadId: string;
   teamId: string;
   organizationId: string;
   threadHasTitle: boolean;
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
            return rows;
         });

         if (
            messageCount >= MIN_SUGGESTION_MESSAGE_COUNT &&
            messageCount % SUGGESTION_MESSAGE_INTERVAL === 0
         ) {
            await enqueueRefreshSuggestions(deps.workflowClient, {
               threadId: deps.threadId,
               teamId: deps.teamId,
               organizationId: deps.organizationId,
               messageCount,
            }).catch((err: unknown) => {
               log.error({
                  module: "agents.persist-middleware",
                  message: "failed enqueue refresh-suggestions",
                  err,
               });
            });
         }

         if (!deps.threadHasTitle && messageCount >= MIN_TITLE_MESSAGE_COUNT) {
            await enqueueGenerateThreadTitle(deps.workflowClient, {
               threadId: deps.threadId,
               teamId: deps.teamId,
               organizationId: deps.organizationId,
            }).catch((err: unknown) => {
               log.error({
                  module: "agents.persist-middleware",
                  message: "failed enqueue generate-title",
                  err,
               });
            });
         }

         const assistantRow = inserted.at(-1);
         if (assistantRow) {
            const publish = await agentsSseEvents.publish(
               deps.redis,
               { kind: "team", id: deps.teamId },
               {
                  type: "agent.message.persisted",
                  payload: {
                     threadId: deps.threadId,
                     messageId: assistantRow.id,
                     role: "assistant",
                  },
               },
            );
            if (publish.isErr()) {
               log.error({
                  module: "agents.persist-middleware",
                  message: "failed publish SSE persisted",
                  err: publish.error,
               });
            }
         }
      },
   };
}
