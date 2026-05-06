import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";

const agentEventSchema = z.discriminatedUnion("type", [
   z.object({
      type: z.literal("agent.thread.title_updated"),
      payload: z.object({
         threadId: z.string().uuid(),
         title: z.string(),
      }),
   }),
   z.object({
      type: z.literal("agent.thread.created"),
      payload: z.object({ threadId: z.string().uuid() }),
   }),
   z.object({
      type: z.literal("agent.message.persisted"),
      payload: z.object({
         threadId: z.string().uuid(),
         messageId: z.string().uuid(),
         role: z.enum(["user", "assistant", "system"]),
      }),
   }),
]);

export function useAgentLive() {
   const queryClient = useQueryClient();
   const { data } = useQuery(
      orpc.notifications.subscribe.experimental_liveOptions({ retry: true }),
   );

   useEffect(() => {
      if (!data) return;
      const parsed = agentEventSchema.safeParse({
         type: data.type,
         payload: data.payload,
      });
      if (!parsed.success) return;
      const event = parsed.data;
      if (
         event.type === "agent.thread.title_updated" ||
         event.type === "agent.thread.created"
      ) {
         void queryClient.invalidateQueries({
            queryKey: orpc.threads.list.key(),
         });
      }
      if (event.type === "agent.message.persisted") {
         void queryClient.invalidateQueries({
            queryKey: orpc.threads.getById.key({
               input: { threadId: event.payload.threadId },
            }),
         });
      }
   }, [data, queryClient]);
}
