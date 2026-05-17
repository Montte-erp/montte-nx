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
import type { PgBossClient } from "@core/pg-boss/client";
import type { Redis } from "@core/redis/connection";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { getLogger } from "@core/logging/root";
import { agentsSseEvents } from "@modules/agents/sse";
import { enqueueGenerateThreadTitleJob } from "@modules/agents/jobs/generate-title-job";
import { enqueueRefreshSuggestions } from "@modules/agents/workflows/refresh-suggestions-workflow";

const logger = getLogger().child({ module: "agents.persist-middleware" });
const MIN_TITLE_MESSAGE_COUNT = 2;
const MIN_SUGGESTION_MESSAGE_COUNT = 4;
const SUGGESTION_MESSAGE_INTERVAL = 4;

export interface PersistMiddlewareDeps {
   db: DatabaseInstance;
   pgBoss: PgBossClient;
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
            logger.warn(
               { threadId: deps.threadId },
               "agent chat produced no assistant parts",
            );
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

            if (
               !deps.threadHasTitle &&
               messageCount >= MIN_TITLE_MESSAGE_COUNT
            ) {
               await enqueueGenerateThreadTitleJob({
                  boss: deps.pgBoss,
                  tx,
                  input: {
                     threadId: deps.threadId,
                     teamId: deps.teamId,
                     organizationId: deps.organizationId,
                  },
               });
            }

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
            }).catch((err: unknown) =>
               logger.error({ err }, "failed enqueue refresh-suggestions"),
            );
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
               logger.error(
                  { err: publish.error },
                  "failed publish SSE persisted",
               );
            }
         }
      },
   };
}
