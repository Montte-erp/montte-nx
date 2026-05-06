import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import type { UIMessage } from "@tanstack/ai";
import { z } from "zod";
import { client } from "@/integrations/orpc/client";
import type { ChatMessage, ChatThread } from "./chat-types";

const dateLikeSchema = z.custom<Date | string | null>();
const messagePartsSchema = z.custom<UIMessage["parts"]>();

const messageMetadataSchema = z
   .object({
      traceId: z.string().optional(),
      pageContext: z
         .object({
            route: z.string().optional(),
            title: z.string().optional(),
            summary: z.string().optional(),
            skillHint: z.string().optional(),
         })
         .optional(),
   })
   .nullable();

const chatMessageSchema = z.object({
   id: z.string().uuid(),
   role: z.enum(["system", "user", "assistant"]),
   parts: messagePartsSchema,
   metadata: messageMetadataSchema,
   threadId: z.string().uuid(),
   createdAt: z.string(),
});

const chatThreadSchema = z.object({
   id: z.string().uuid(),
   title: z.string().nullable(),
   suggestions: z.array(z.string()),
   lastMessageAt: dateLikeSchema,
   createdAt: dateLikeSchema,
   updatedAt: dateLikeSchema,
});

const messagesCollections = new Map<
   string,
   ReturnType<typeof createMessagesCollection>
>();
const threadDetailCollections = new Map<
   string,
   ReturnType<typeof createThreadDetailCollection>
>();
const threadsCollections = new WeakMap<
   QueryClient,
   ReturnType<typeof createThreadsCollection>
>();

function toChatThread(thread: ChatThread): ChatThread {
   return {
      ...thread,
      suggestions: thread.suggestions ?? [],
   };
}

function createThreadsCollection(queryClient: QueryClient) {
   return createCollection(
      queryCollectionOptions({
         id: "chat-threads",
         queryClient,
         queryKey: ["chat-threads"],
         queryFn: async () => {
            const data = await client.threads.list({ limit: 50 });
            return data.threads.map((thread) =>
               toChatThread({ ...thread, suggestions: [] }),
            );
         },
         schema: chatThreadSchema,
         getKey: (thread) => thread.id,
      }),
   );
}

function createMessagesCollection(threadId: string, queryClient: QueryClient) {
   return createCollection(
      queryCollectionOptions({
         id: `chat-messages:${threadId}`,
         queryClient,
         queryKey: ["chat-messages", threadId],
         queryFn: async () => {
            const data = await client.threads.getById({ threadId });
            return data.messages;
         },
         schema: chatMessageSchema,
         getKey: (message) => message.id,
      }),
   );
}

function createThreadDetailCollection(
   threadId: string,
   queryClient: QueryClient,
) {
   return createCollection(
      queryCollectionOptions({
         id: `chat-thread:${threadId}`,
         queryClient,
         queryKey: ["chat-thread-detail", threadId],
         queryFn: async () => {
            const data = await client.threads.getById({ threadId });
            return [
               toChatThread({
                  id: data.thread.id,
                  title: data.thread.title,
                  suggestions: data.thread.suggestions ?? [],
                  lastMessageAt: data.thread.lastMessageAt,
                  createdAt: data.thread.createdAt,
                  updatedAt: data.thread.updatedAt,
               }),
            ];
         },
         schema: chatThreadSchema,
         getKey: (thread) => thread.id,
      }),
   );
}

export function getThreadsCollection(queryClient: QueryClient) {
   const existing = threadsCollections.get(queryClient);
   if (existing) return existing;
   const collection = createThreadsCollection(queryClient);
   threadsCollections.set(queryClient, collection);
   return collection;
}

export function getMessagesCollection(
   threadId: string,
   queryClient: QueryClient,
) {
   const existing = messagesCollections.get(threadId);
   if (existing) return existing;
   const collection = createMessagesCollection(threadId, queryClient);
   messagesCollections.set(threadId, collection);
   return collection;
}

export function getThreadDetailCollection(
   threadId: string,
   queryClient: QueryClient,
) {
   const existing = threadDetailCollections.get(threadId);
   if (existing) return existing;
   const collection = createThreadDetailCollection(threadId, queryClient);
   threadDetailCollections.set(threadId, collection);
   return collection;
}

export function writeThreadSnapshot(
   queryClient: QueryClient,
   thread: ChatThread,
) {
   const item = toChatThread(thread);
   getThreadsCollection(queryClient).utils.writeUpsert(item);
   threadDetailCollections.get(thread.id)?.utils.writeUpsert(item);
}

export function writeThreadTitle(
   queryClient: QueryClient,
   threadId: string,
   title: string,
) {
   getThreadsCollection(queryClient).utils.writeUpdate({ id: threadId, title });
   threadDetailCollections
      .get(threadId)
      ?.utils.writeUpdate({ id: threadId, title });
}

export function writeThreadSuggestions(
   threadId: string,
   suggestions: string[],
) {
   threadDetailCollections
      .get(threadId)
      ?.utils.writeUpdate({ id: threadId, suggestions });
}

export function writePersistedMessage(threadId: string, message: ChatMessage) {
   messagesCollections.get(threadId)?.utils.writeUpsert(message);
}

export function removeMessageFromChatData(threadId: string, messageId: string) {
   messagesCollections.get(threadId)?.utils.writeDelete(messageId);
}

export function refreshChatData(queryClient: QueryClient, threadId?: string) {
   void getThreadsCollection(queryClient).utils.refetch();
   if (!threadId) return;
   void messagesCollections.get(threadId)?.utils.refetch();
   void threadDetailCollections.get(threadId)?.utils.refetch();
}
