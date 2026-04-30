import { useMutation, useQuery, skipToken } from "@tanstack/react-query";
import { useStore, shallow } from "@tanstack/react-store";
import { stream as aiStream } from "@tanstack/ai-client";
import { useChat, type UIMessage } from "@tanstack/ai-react";
import { useEffect, useRef } from "react";
import { fromPromise } from "neverthrow";
import { toast } from "sonner";
import {
   dbMessagesToUIMessages,
   pendingApprovalIds,
   uiMessagesOnly,
   uiMessagesToThreadMessages,
} from "@modules/agents/messages";
import { client, orpc } from "@/integrations/orpc/client";
import {
   loadRubiThread,
   markRubiThreadHydrated,
   resetRubiChat,
   startRubiThread,
   rubiChatStore,
} from "./rubi-chat-store";

export interface RubiSendArgs {
   text: string;
   skillHint?: string;
   pageRoute?: string;
   pageTitle?: string;
}

const rubiConnection = aiStream(async function* (messages) {
   const { activeThreadId, pageContext } = rubiChatStore.state;
   if (activeThreadId === null) return;

   const response = await client.rubi.send({
      threadId: activeThreadId,
      pageContext,
      messages: uiMessagesOnly(messages),
   });
   yield* response;
});

export function useRubiChat() {
   const { activeThreadId, hydratedThreadId } = useStore(
      rubiChatStore,
      (state) => ({
         activeThreadId: state.activeThreadId,
         hydratedThreadId: state.hydratedThreadId,
      }),
      shallow,
   );

   const threadQuery = useQuery(
      orpc.threads.getById.queryOptions({
         input: activeThreadId ? { threadId: activeThreadId } : skipToken,
      }),
   );

   const createThread = useMutation(
      orpc.threads.create.mutationOptions({
         meta: { skipGlobalInvalidation: true },
      }),
   );
   const syncMessages = useMutation(
      orpc.threads.syncMessages.mutationOptions({
         meta: { skipGlobalInvalidation: true },
      }),
   );

   const messagesRef = useRef<UIMessage[]>([]);

   const chat = useChat({
      connection: rubiConnection,
      onFinish: async () => {
         const { activeThreadId } = rubiChatStore.state;
         if (activeThreadId === null) return;
         const snapshot = messagesRef.current;
         const result = await fromPromise(
            syncMessages.mutateAsync({
               threadId: activeThreadId,
               messages: uiMessagesToThreadMessages(snapshot),
            }),
            () => null,
         );
         if (result.isErr()) {
            toast.error("Falha ao salvar resposta da Rubi.");
            return;
         }
      },
      onError: async () => {
         const { activeThreadId } = rubiChatStore.state;
         const snapshot = messagesRef.current;
         if (activeThreadId !== null && snapshot.length > 0) {
            await fromPromise(
               syncMessages.mutateAsync({
                  threadId: activeThreadId,
                  messages: uiMessagesToThreadMessages(snapshot),
               }),
               () => null,
            );
         }
         toast.error("Falha no streaming da Rubi.");
      },
   });

   messagesRef.current = chat.messages;

   useEffect(() => {
      if (activeThreadId === null) {
         if (hydratedThreadId !== null) {
            chat.clear();
         }
         return;
      }
      if (hydratedThreadId === activeThreadId) return;
      const data = threadQuery.data;
      if (data === undefined) return;
      chat.setMessages(dbMessagesToUIMessages(data.messages));
      markRubiThreadHydrated(activeThreadId);
   }, [activeThreadId, hydratedThreadId, threadQuery.data, chat]);

   async function sendMessage(args: RubiSendArgs) {
      const text = args.text.trim();
      if (!text || chat.isLoading) return;
      const result = await fromPromise(
         (async () => {
            let threadId = rubiChatStore.state.activeThreadId;
            if (threadId === null) {
               const created = await createThread.mutateAsync({
                  title: text.slice(0, 80),
               });
               threadId = created.id;
            }
            startRubiThread(threadId, {
               skillHint: args.skillHint,
               route: args.pageRoute,
               title: args.pageTitle,
            });
            await chat.sendMessage(text);
         })(),
         () => null,
      );
      if (result.isErr()) {
         toast.error("Falha ao enviar mensagem.");
      }
   }

   function reset() {
      resetRubiChat();
      chat.clear();
   }

   function loadThread(id: string) {
      loadRubiThread(id);
   }

   const approvalIds = pendingApprovalIds(chat.messages);

   return {
      threadId: activeThreadId,
      messages: chat.messages,
      isStreaming: chat.isLoading,
      sendMessage,
      approveTool: (id: string) =>
         chat.addToolApprovalResponse({ id, approved: true }),
      rejectTool: (id: string) =>
         chat.addToolApprovalResponse({ id, approved: false }),
      pendingApprovalIds: approvalIds,
      approveAll: async () => {
         for (const id of approvalIds) {
            await chat.addToolApprovalResponse({ id, approved: true });
         }
      },
      rejectAll: async () => {
         for (const id of approvalIds) {
            await chat.addToolApprovalResponse({ id, approved: false });
         }
      },
      reset,
      loadThread,
   };
}
