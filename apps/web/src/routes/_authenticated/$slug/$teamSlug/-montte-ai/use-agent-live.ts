import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";
import {
   refreshChatData,
   writeThreadSuggestions,
   writeThreadTitle,
} from "./chat-data";

function stringField(payload: unknown, key: string): string | null {
   if (typeof payload !== "object" || payload === null) return null;
   const value = Object.entries(payload).find(([name]) => name === key)?.[1];
   return typeof value === "string" ? value : null;
}

function stringArrayField(payload: unknown, key: string): string[] | null {
   if (typeof payload !== "object" || payload === null) return null;
   const value = Object.entries(payload).find(([name]) => name === key)?.[1];
   if (!Array.isArray(value)) return null;
   if (!value.every((item) => typeof item === "string")) return null;
   return value;
}

export function useAgentLive() {
   const queryClient = useQueryClient();
   const { data } = useQuery(
      orpc.notifications.subscribe.experimental_liveOptions({ retry: true }),
   );

   useEffect(() => {
      if (!data) return;
      const threadId = stringField(data.payload, "threadId");
      if (threadId === null) return;

      if (data.type === "agent.thread.title_updated") {
         const title = stringField(data.payload, "title");
         if (title === null) return;
         writeThreadTitle(queryClient, threadId, title);
         return;
      }

      if (data.type === "agent.thread.suggestions_updated") {
         const suggestions = stringArrayField(data.payload, "suggestions");
         if (suggestions === null) return;
         writeThreadSuggestions(queryClient, threadId, suggestions);
         return;
      }

      if (data.type === "agent.thread.created") {
         refreshChatData(queryClient);
         return;
      }

      if (data.type === "agent.message.persisted")
         refreshChatData(queryClient, threadId);
   }, [data, queryClient]);
}
