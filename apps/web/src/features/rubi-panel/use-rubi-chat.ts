import {
   useMutation,
   useQuery,
   useQueryClient,
   skipToken,
} from "@tanstack/react-query";
import { useStore, shallow } from "@tanstack/react-store";
import { fetchHttpStream } from "@tanstack/ai-client";
import { useChat, type UIMessage } from "@tanstack/ai-react";
import { useEffect, useMemo, useRef } from "react";
import { fromPromise } from "neverthrow";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import {
   loadRubiThread,
   resetRubiChat,
   rubiChatStore,
   setRubiThreadId,
} from "./rubi-chat-store";

export interface RubiSendArgs {
   text: string;
   skillHint?: string;
   pageRoute?: string;
   pageTitle?: string;
}

interface DbMessage {
   id: string;
   role: "system" | "user" | "assistant" | "tool";
   parts: unknown;
}

function dbMessagesToUIMessages(rows: DbMessage[]): UIMessage[] {
   const out: UIMessage[] = [];
   for (const row of rows) {
      if (!Array.isArray(row.parts)) continue;
      out.push({
         id: row.id,
         role: row.role,
         parts: row.parts,
      } as UIMessage);
   }
   return out;
}

export function useRubiChat() {
   const queryClient = useQueryClient();
   const { threadId } = useStore(
      rubiChatStore,
      (s) => ({ threadId: s.threadId }),
      shallow,
   );
   const hydratedThreadRef = useRef<string | null>(null);
   const requestContextRef = useRef<{
      threadId?: string;
      pageContext?: {
         skillHint?: string;
         route?: string;
         title?: string;
      };
   }>({});

   const messagesQuery = useQuery(
      orpc.threads.messages.queryOptions({
         input: threadId ? { threadId } : skipToken,
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

   const connection = useMemo(
      () =>
         fetchHttpStream("/api/rubi-chat", () => ({
            body: {
               data: {
                  threadId: requestContextRef.current.threadId,
                  pageContext: requestContextRef.current.pageContext,
               },
            },
         })),
      [],
   );

   const messagesRef = useRef<UIMessage[]>([]);

   const chat = useChat({
      connection,
      onFinish: async () => {
         const id = rubiChatStore.state.threadId;
         if (!id) return;
         const snapshot = messagesRef.current;
         const result = await fromPromise(
            syncMessages.mutateAsync({
               threadId: id,
               messages: snapshot.map((m) => ({
                  role: m.role,
                  parts: m.parts as never,
               })),
            }),
            (e) => (e instanceof Error ? e : new Error(String(e))),
         );
         if (result.isErr()) {
            toast.error("Falha ao salvar resposta da Rubi.");
            return;
         }
         await queryClient.invalidateQueries({
            queryKey: orpc.threads.messages.queryKey({
               input: { threadId: id },
            }),
         });
      },
      onError: async (error) => {
         const id = rubiChatStore.state.threadId;
         const snapshot = messagesRef.current;
         if (id && snapshot.length > 0) {
            await fromPromise(
               syncMessages.mutateAsync({
                  threadId: id,
                  messages: snapshot.map((m) => ({
                     role: m.role,
                     parts: m.parts as never,
                  })),
               }),
               (e) => (e instanceof Error ? e : new Error(String(e))),
            );
         }
         const message = error.message || "";
         const transient = /ECONNRESET|terminated|fetch failed|network/i.test(
            message,
         );
         toast.error(
            transient
               ? "Conexão caiu durante a resposta. Tente enviar novamente."
               : message || "Falha no streaming.",
         );
      },
   });

   messagesRef.current = chat.messages;

   useEffect(() => {
      if (!threadId) {
         if (hydratedThreadRef.current !== null) {
            chat.clear();
            hydratedThreadRef.current = null;
         }
         return;
      }
      if (hydratedThreadRef.current === threadId) return;
      const data = messagesQuery.data;
      if (!data) return;
      chat.setMessages(dbMessagesToUIMessages(data.messages));
      hydratedThreadRef.current = threadId;
   }, [threadId, messagesQuery.data, chat]);

   async function sendMessage(args: RubiSendArgs) {
      const text = args.text.trim();
      if (!text || chat.isLoading) return;
      const result = await fromPromise(
         (async () => {
            let id = rubiChatStore.state.threadId;
            if (!id) {
               const created = await createThread.mutateAsync({
                  title: text.slice(0, 80),
               });
               id = created.id;
               setRubiThreadId(id);
               hydratedThreadRef.current = id;
            }
            requestContextRef.current = {
               threadId: id,
               pageContext: {
                  skillHint: args.skillHint,
                  route: args.pageRoute,
                  title: args.pageTitle,
               },
            };
            await chat.sendMessage(text);
         })(),
         (e) => (e instanceof Error ? e : new Error(String(e))),
      );
      if (result.isErr()) {
         toast.error(result.error.message || "Falha ao enviar mensagem.");
      }
   }

   function reset() {
      resetRubiChat();
      chat.clear();
      hydratedThreadRef.current = null;
   }

   function loadThread(id: string) {
      loadRubiThread(id);
      hydratedThreadRef.current = null;
   }

   const pendingApprovalIds = useMemo(() => {
      const ids: string[] = [];
      for (const msg of chat.messages) {
         if (msg.role !== "assistant") continue;
         for (const part of msg.parts) {
            if ((part as { type?: string }).type !== "tool-call") continue;
            const tc = part as {
               state?: string;
               approval?: { id: string; approved?: boolean };
            };
            if (
               tc.state === "approval-requested" &&
               tc.approval &&
               tc.approval.approved === undefined
            ) {
               ids.push(tc.approval.id);
            }
         }
      }
      return ids;
   }, [chat.messages]);

   return {
      threadId,
      messages: chat.messages,
      isStreaming: chat.isLoading,
      sendMessage,
      approveTool: (id: string) =>
         chat.addToolApprovalResponse({ id, approved: true }),
      rejectTool: (id: string) =>
         chat.addToolApprovalResponse({ id, approved: false }),
      pendingApprovalIds,
      approveAll: async () => {
         for (const id of pendingApprovalIds) {
            await chat.addToolApprovalResponse({ id, approved: true });
         }
      },
      rejectAll: async () => {
         for (const id of pendingApprovalIds) {
            await chat.addToolApprovalResponse({ id, approved: false });
         }
      },
      reset,
      loadThread,
   };
}
