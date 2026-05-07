import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { client, type Outputs } from "@/integrations/orpc/client";

export type ChatThreadListItem = Outputs["threads"]["list"]["threads"][number];
export type ChatThreadSnapshot = Outputs["threads"]["getById"]["thread"];
export type ChatMessage = Outputs["threads"]["getById"]["messages"][number];
export type ChatThreadDetail = ChatThreadSnapshot & { suggestions: string[] };

export interface ChatThreadBundle {
   id: string;
   thread: ChatThreadDetail;
   messages: ChatMessage[];
}

const threadCollections = new WeakMap<
   QueryClient,
   Map<string, ReturnType<typeof createThreadCollection>>
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

function createThreadCollection(threadId: string, queryClient: QueryClient) {
   return createCollection(
      queryCollectionOptions({
         id: `chat-thread:${threadId}`,
         queryClient,
         queryKey: ["chat-thread", threadId],
         queryFn: async (): Promise<ChatThreadBundle[]> => {
            const data = await client.threads.getById({ threadId });
            const thread = {
               ...data.thread,
               suggestions: data.thread.suggestions ?? [],
            };
            return [
               {
                  id: thread.id,
                  thread,
                  messages: data.messages,
               },
            ];
         },
         getKey: (bundle) => bundle.id,
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

export function getThreadCollection(
   threadId: string,
   queryClient: QueryClient,
) {
   const collections = getCollectionMap(threadCollections, queryClient);
   const existing = collections.get(threadId);
   if (existing) return existing;
   const collection = createThreadCollection(threadId, queryClient);
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
   const thread = getCollectionMap(threadCollections, queryClient).get(
      threadId,
   );
   const current = thread?.get(threadId);
   if (!thread || !current) return;
   thread.utils.writeUpdate({
      id: threadId,
      thread: { ...current.thread, title },
   });
}

export function writeThreadSuggestions(
   queryClient: QueryClient,
   threadId: string,
   suggestions: string[],
) {
   const thread = getCollectionMap(threadCollections, queryClient).get(
      threadId,
   );
   const current = thread?.get(threadId);
   if (!thread || !current) return;
   thread.utils.writeUpdate({
      id: threadId,
      thread: { ...current.thread, suggestions },
   });
}

export async function refreshChatData(
   queryClient: QueryClient,
   threadId?: string,
) {
   void getThreadsCollection(queryClient).utils.refetch();
   if (!threadId) return;
   await getThreadCollection(threadId, queryClient).utils.refetch();
}
