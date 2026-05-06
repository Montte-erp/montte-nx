import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { client, type Outputs } from "@/integrations/orpc/client";

export type ChatThreadListItem = Outputs["threads"]["list"]["threads"][number];
export type ChatThreadSnapshot = Outputs["threads"]["getById"]["thread"];
export type ChatMessage = Outputs["threads"]["getById"]["messages"][number];
export type ChatThreadDetail = ChatThreadSnapshot & { suggestions: string[] };

const messagesCollections = new WeakMap<
   QueryClient,
   Map<string, ReturnType<typeof createMessagesCollection>>
>();
const threadDetailCollections = new WeakMap<
   QueryClient,
   Map<string, ReturnType<typeof createThreadDetailCollection>>
>();
const threadsCollections = new WeakMap<
   QueryClient,
   ReturnType<typeof createThreadsCollection>
>();

function getCollectionMap<T>(
   store: WeakMap<QueryClient, Map<string, T>>,
   queryClient: QueryClient,
) {
   const existing = store.get(queryClient);
   if (existing) return existing;
   const collectionMap = new Map<string, T>();
   store.set(queryClient, collectionMap);
   return collectionMap;
}

function createThreadsCollection(queryClient: QueryClient) {
   return createCollection(
      queryCollectionOptions({
         id: "chat-threads",
         queryClient,
         queryKey: ["chat-threads"],
         queryFn: async () => {
            const data = await client.threads.list({ limit: 50 });
            return data.threads;
         },
         getKey: (thread) => thread.id,
      }),
   );
}

function createMessagesCollection(threadId: string, queryClient: QueryClient) {
   return createCollection(
      queryCollectionOptions({
         id: `chat-messages:${threadId}`,
         queryClient,
         queryKey: ["chat-thread-messages", threadId],
         queryFn: async (): Promise<ChatMessage[]> => {
            const data = await client.threads.getById({ threadId });
            return data.messages;
         },
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
         queryFn: async (): Promise<ChatThreadDetail[]> => {
            const data = await client.threads.getById({ threadId });
            return [
               {
                  ...data.thread,
                  suggestions: data.thread.suggestions ?? [],
               },
            ];
         },
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
   const collections = getCollectionMap(messagesCollections, queryClient);
   const existing = collections.get(threadId);
   if (existing) return existing;
   const collection = createMessagesCollection(threadId, queryClient);
   collections.set(threadId, collection);
   return collection;
}

export function getThreadDetailCollection(
   threadId: string,
   queryClient: QueryClient,
) {
   const collections = getCollectionMap(threadDetailCollections, queryClient);
   const existing = collections.get(threadId);
   if (existing) return existing;
   const collection = createThreadDetailCollection(threadId, queryClient);
   collections.set(threadId, collection);
   return collection;
}

export function writeThreadTitle(
   queryClient: QueryClient,
   threadId: string,
   title: string,
) {
   const threads = getThreadsCollection(queryClient);
   if (threads.has(threadId))
      threads.utils.writeUpdate({ id: threadId, title });
   const detail = getCollectionMap(threadDetailCollections, queryClient).get(
      threadId,
   );
   if (detail?.has(threadId)) detail.utils.writeUpdate({ id: threadId, title });
}

export function writeThreadSuggestions(
   queryClient: QueryClient,
   threadId: string,
   suggestions: string[],
) {
   const detail = getCollectionMap(threadDetailCollections, queryClient).get(
      threadId,
   );
   if (detail?.has(threadId))
      detail.utils.writeUpdate({ id: threadId, suggestions });
}

export async function refreshChatData(
   queryClient: QueryClient,
   threadId?: string,
) {
   void getThreadsCollection(queryClient).utils.refetch();
   if (!threadId) return;
   await getCollectionMap(messagesCollections, queryClient)
      .get(threadId)
      ?.utils.refetch();
   await getCollectionMap(threadDetailCollections, queryClient)
      .get(threadId)
      ?.utils.refetch();
}
