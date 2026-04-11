import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useCallback, useMemo, useRef } from "react";
import { chatContextStore } from "@/features/rubi-chat/stores/chat-context-store";
import { client, orpc } from "@/integrations/orpc/client";

interface UseRubiChatOptions {
   teamId: string;
   onThreadCreated?: (threadId: string) => void;
}

export function useRubiChat({ teamId, onThreadCreated }: UseRubiChatOptions) {
   const queryClient = useQueryClient();
   const createThread = useMutation(orpc.chat.createThread.mutationOptions({}));

   const activeThreadIdRef = useRef<string | undefined>(undefined);
   const pendingThreadRef = useRef<Promise<string> | undefined>(undefined);
   const onThreadCreatedRef = useRef(onThreadCreated);
   onThreadCreatedRef.current = onThreadCreated;
   const createThreadMutateRef = useRef(createThread.mutateAsync);
   createThreadMutateRef.current = createThread.mutateAsync;
   const teamIdRef = useRef(teamId);
   teamIdRef.current = teamId;

   const model = useStore(chatContextStore, (s) => s.model);
   const thinkingBudget = useStore(chatContextStore, (s) => s.thinkingBudget);

   const ensureThread = useCallback(async (): Promise<string> => {
      if (activeThreadIdRef.current) return activeThreadIdRef.current;
      pendingThreadRef.current ??= createThreadMutateRef
         .current({ teamId: teamIdRef.current })
         .then((thread) => {
            activeThreadIdRef.current = thread.id;
            onThreadCreatedRef.current?.(thread.id);
            void queryClient.invalidateQueries({
               queryKey: orpc.chat.listThreads.queryKey({
                  input: { teamId: teamIdRef.current },
               }),
            });
            return thread.id;
         })
         .finally(() => {
            pendingThreadRef.current = undefined;
         });
      return pendingThreadRef.current;
   }, [queryClient]);

   const connection = useMemo(
      () =>
         fetchServerSentEvents("/api/chat", async () => {
            const threadId = await ensureThread();
            return {
               body: {
                  teamId: teamIdRef.current,
                  threadId,
                  model,
                  ...(thinkingBudget > 0 ? { thinkingBudget } : {}),
               },
            };
         }),
      [ensureThread, model, thinkingBudget],
   );

   const chat = useChat({ connection });

   const selectThread = useCallback(
      async (threadId: string) => {
         activeThreadIdRef.current = threadId;
         const messages = await client.chat.getThreadMessages({ threadId });
         chat.setMessages(
            messages.map((m) => ({
               id: m.id,
               role: m.role as "user" | "assistant",
               parts: Array.isArray(m.parts) ? m.parts : [],
            })),
         );
      },
      [chat],
   );

   const newThread = useCallback(() => {
      activeThreadIdRef.current = undefined;
      pendingThreadRef.current = undefined;
      chat.clear();
   }, [chat]);

   const deleteThread = useCallback(
      async (threadId: string) => {
         await client.chat.deleteThread({ threadId });
         if (activeThreadIdRef.current === threadId) {
            newThread();
         }
         void queryClient.invalidateQueries({
            queryKey: orpc.chat.listThreads.queryKey({
               input: { teamId: teamIdRef.current },
            }),
         });
      },
      [newThread, queryClient],
   );

   return {
      ...chat,
      activeThreadId: activeThreadIdRef,
      selectThread,
      newThread,
      deleteThread,
   };
}
