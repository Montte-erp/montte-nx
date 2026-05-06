import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import type { UIMessage } from "@tanstack/ai";
import type { MessageMetadata } from "@core/database/schemas/messages";
import { client } from "@/integrations/orpc/client";

export type MessageRow = {
   id: string;
   role: "system" | "user" | "assistant";
   parts: UIMessage["parts"];
   metadata: MessageMetadata | null;
   threadId: string;
   createdAt: string;
};

export type ThreadDetail = {
   id: string;
   title: string | null;
   suggestions: string[];
};

const messagesCollections = new Map<
   string,
   ReturnType<typeof createMessagesCollection>
>();
const threadCollections = new Map<
   string,
   ReturnType<typeof createThreadCollection>
>();

function createMessagesCollection(threadId: string, queryClient: QueryClient) {
   return createCollection(
      queryCollectionOptions<MessageRow>({
         id: `chat-messages:${threadId}`,
         queryClient,
         queryKey: ["chat-messages", threadId],
         queryFn: async () => {
            const data = await client.threads.getById({ threadId });
            return data.messages;
         },
         getKey: (m) => m.id,
      }),
   );
}

function createThreadCollection(threadId: string, queryClient: QueryClient) {
   return createCollection(
      queryCollectionOptions<ThreadDetail>({
         id: `chat-thread:${threadId}`,
         queryClient,
         queryKey: ["chat-thread", threadId],
         queryFn: async () => {
            const data = await client.threads.getById({ threadId });
            return [
               {
                  id: data.thread.id,
                  title: data.thread.title,
                  suggestions: data.thread.suggestions ?? [],
               },
            ];
         },
         getKey: (t) => t.id,
      }),
   );
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

export function getThreadCollection(
   threadId: string,
   queryClient: QueryClient,
) {
   const existing = threadCollections.get(threadId);
   if (existing) return existing;
   const collection = createThreadCollection(threadId, queryClient);
   threadCollections.set(threadId, collection);
   return collection;
}

export function refreshThreadCollections(threadId: string) {
   void messagesCollections.get(threadId)?.utils.refetch();
   void threadCollections.get(threadId)?.utils.refetch();
}
