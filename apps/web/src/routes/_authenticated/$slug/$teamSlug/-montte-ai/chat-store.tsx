import { useQueryClient } from "@tanstack/react-query";
import { createStore, useStore } from "@tanstack/react-store";
import { useLiveQuery } from "@tanstack/react-db";
import type { UIMessage } from "@tanstack/ai-react";
import { createContext, useContext, useMemo, useRef } from "react";
import {
   Briefcase,
   Contact,
   FolderTree,
   Gauge,
   Sparkles,
   Tag,
   Wallet,
   type LucideIcon,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import { toast } from "sonner";
import { createPersistedStore } from "@/lib/store";
import { client } from "@/integrations/orpc/client";
import {
   type ChatMessage,
   getMessagesCollection,
   getThreadDetailCollection,
   getThreadsCollection,
   refreshChatData,
   removeMessageFromChatData,
   writeThreadSnapshot,
} from "./chat-data";
import { useAgentLive } from "./use-agent-live";
import { useChatRuntime } from "./chat-runtime";

type ChatMessageMetadata = ChatMessage["metadata"];
type ChatPageContext = NonNullable<
   NonNullable<ChatMessageMetadata>["pageContext"]
>;

export type AgentScopeId =
   | "auto"
   | "servicos"
   | "contatos"
   | "categorias"
   | "estoque"
   | "financeiro"
   | "analises";

export interface AgentScope {
   id: AgentScopeId;
   label: string;
   icon: LucideIcon;
   skillHint?: string;
}

const AUTO_SCOPE: AgentScope = { id: "auto", label: "Auto", icon: Sparkles };

export const SCOPES: AgentScope[] = [
   AUTO_SCOPE,
   {
      id: "servicos",
      label: "Serviços",
      icon: Briefcase,
      skillHint: "services",
   },
   { id: "contatos", label: "Contatos", icon: Contact },
   { id: "categorias", label: "Centro de Custo", icon: FolderTree },
   { id: "estoque", label: "Estoque", icon: Tag },
   { id: "financeiro", label: "Financeiro", icon: Wallet },
   { id: "analises", label: "Análises", icon: Gauge },
];

export const SCOPE_SUGGESTIONS: AgentScope[] = SCOPES.filter(
   (scope) => scope.id !== "auto",
);

function getScope(id: AgentScopeId): AgentScope {
   return SCOPES.find((scope) => scope.id === id) ?? AUTO_SCOPE;
}

interface ChatState {
   activeThreadId: string | null;
   panelOpen: boolean;
}

const chatStore = createStore<ChatState>({
   activeThreadId: null,
   panelOpen: false,
});

const scopeStore = createPersistedStore<{ id: AgentScopeId }>(
   "montte:chat:scope",
   { id: "auto" },
);

export const setActiveThread = (threadId: string | null) =>
   chatStore.setState((s) => ({ ...s, activeThreadId: threadId }));

export const togglePanel = () =>
   chatStore.setState((s) => ({ ...s, panelOpen: !s.panelOpen }));

export const selectScope = (id: AgentScopeId) =>
   scopeStore.setState(() => ({ id }));

export const useActiveThreadId = () =>
   useStore(chatStore, (s) => s.activeThreadId);

export const usePanelOpen = () => useStore(chatStore, (s) => s.panelOpen);

export const useSelectedScope = (): AgentScope => {
   const id = useStore(scopeStore, (s) => s.id);
   return getScope(id);
};

function pickPageContext(): ChatPageContext | undefined {
   const skillHint = getScope(scopeStore.state.id).skillHint;
   return skillHint ? { skillHint } : undefined;
}

export interface ChatSession {
   messages: UIMessage[];
   suggestions: string[];
   status: "ready" | "submitted" | "streaming" | "error";
   error: Error | null;
   isStreaming: boolean;
   isSubmitting: boolean;
   pendingApprovalIds: string[];
   metadataFor: (messageId: string) => ChatMessageMetadata | undefined;
   sendMessage: (text: string) => Promise<void>;
   stop: () => void;
   regenerateFrom: (userMessageId: string) => Promise<void>;
   editAndResend: (userMessageId: string, text: string) => Promise<void>;
   deleteMessage: (messageId: string) => Promise<void>;
   approveTool: (approvalId: string) => Promise<void>;
   rejectTool: (approvalId: string) => Promise<void>;
   approveAll: () => Promise<void>;
   rejectAll: () => Promise<void>;
}

const ChatSessionContext = createContext<ChatSession | null>(null);

export function useChatSession(): ChatSession {
   const ctx = useContext(ChatSessionContext);
   if (ctx === null) {
      throw new Error("useChatSession must be inside <ChatSessionProvider>");
   }
   return ctx;
}

function pendingApprovalIds(messages: UIMessage[]): string[] {
   return messages.flatMap((message) => {
      if (message.role !== "assistant") return [];
      return message.parts.flatMap((part) => {
         if (part.type !== "tool-call") return [];
         if (part.state !== "approval-requested") return [];
         if (part.approval === undefined) return [];
         if (part.approval.approved !== undefined) return [];
         return [part.approval.id];
      });
   });
}

function textContent(message: Pick<UIMessage, "parts">): string {
   return message.parts
      .flatMap((part) => (part.type === "text" ? [part.content] : []))
      .join("");
}

export function ChatSessionProvider({
   children,
}: {
   children: React.ReactNode;
}) {
   const queryClient = useQueryClient();
   const threadId = useActiveThreadId();
   const overlaySnapshotRef = useRef<UIMessage[]>([]);

   useAgentLive();

   const runtime = useChatRuntime({
      getThreadId: () => chatStore.state.activeThreadId,
      getPageContext: pickPageContext,
      onFinish: async () => {
         const id = chatStore.state.activeThreadId;
         if (!id) return;
         await refreshChatData(queryClient, id);
      },
   });
   const chat = runtime.chat;

   const { data: dbMessages = [] } = useLiveQuery(
      (q) =>
         threadId
            ? q
                 .from({ m: getMessagesCollection(threadId, queryClient) })
                 .orderBy(({ m }) => m.createdAt, "asc")
            : null,
      [threadId, queryClient],
   );

   const { data: threadRows = [] } = useLiveQuery(
      (q) =>
         threadId
            ? q.from({ t: getThreadDetailCollection(threadId, queryClient) })
            : null,
      [threadId, queryClient],
   );
   const thread = threadRows[0];

   const status = chat.status;

   const session = useMemo<ChatSession>(() => {
      const dbIds = new Set(dbMessages.map((m) => m.id));
      const lastDbMessage = dbMessages.at(-1);
      if (chat.messages.length > 0) {
         overlaySnapshotRef.current = chat.messages;
      }
      const overlaySource =
         chat.messages.length > 0 ? chat.messages : overlaySnapshotRef.current;
      const overlay = overlaySource.filter((m) => {
         if (dbIds.has(m.id)) return false;
         if (lastDbMessage?.role !== m.role) return true;
         return textContent(m) !== textContent(lastDbMessage);
      });
      if (overlay.length === 0 && overlaySnapshotRef.current.length > 0) {
         overlaySnapshotRef.current = [];
      }
      const messages: UIMessage[] = [
         ...dbMessages.map((m) => ({
            id: m.id,
            role: m.role,
            parts: m.parts,
         })),
         ...overlay,
      ];
      const approvalIds = pendingApprovalIds(messages);
      const metadataMap = new Map(dbMessages.map((m) => [m.id, m.metadata]));

      const ensureThread = async (): Promise<string | null> => {
         const existing = chatStore.state.activeThreadId;
         if (existing !== null) return existing;
         const result = await fromPromise(
            client.threads.create({}),
            () => null,
         );
         if (result.isErr()) {
            toast.error("Falha ao criar conversa.");
            return null;
         }
         writeThreadSnapshot(queryClient, {
            ...result.value,
            suggestions: result.value.suggestions,
         });
         setActiveThread(result.value.id);
         return result.value.id;
      };

      return {
         messages,
         suggestions: thread?.suggestions ?? [],
         status,
         error: chat.error ?? null,
         isStreaming: status === "streaming",
         isSubmitting: status === "submitted",
         pendingApprovalIds: approvalIds,
         metadataFor: (id) => metadataMap.get(id),
         stop: () => chat.stop(),
         approveTool: (id) =>
            chat.addToolApprovalResponse({ id, approved: true }),
         rejectTool: (id) =>
            chat.addToolApprovalResponse({ id, approved: false }),
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
         sendMessage: async (text) => {
            const trimmed = text.trim();
            if (!trimmed || status === "streaming") return;
            const id = await ensureThread();
            if (id === null) return;
            runtime.prepareTurn({ text: trimmed });
            await chat.sendMessage(trimmed);
         },
         regenerateFrom: async (userMessageId) => {
            if (status === "streaming") return;
            const idx = messages.findIndex((m) => m.id === userMessageId);
            if (idx < 0) return;
            runtime.setOverlay(messages.slice(0, idx + 1));
            runtime.prepareTurn({ regenerate: true });
            await chat.reload();
         },
         editAndResend: async (userMessageId, text) => {
            if (status === "streaming") return;
            const trimmed = text.trim();
            if (!trimmed) return;
            const idx = messages.findIndex((m) => m.id === userMessageId);
            if (idx < 0) return;
            runtime.setOverlay(messages.slice(0, idx));
            runtime.prepareTurn({
               text: trimmed,
               replaceFromMessageId: userMessageId,
            });
            await chat.sendMessage(trimmed);
         },
         deleteMessage: async (messageId) => {
            const id = chatStore.state.activeThreadId;
            if (!id) return;
            const result = await fromPromise(
               client.threads.removeMessage({ threadId: id, messageId }),
               () => null,
            );
            if (result.isErr()) {
               toast.error("Falha ao excluir mensagem.");
               return;
            }
            removeMessageFromChatData(queryClient, id, messageId);
            await refreshChatData(queryClient, id);
         },
      };
   }, [chat, status, dbMessages, queryClient, runtime, thread]);

   return (
      <ChatSessionContext.Provider value={session}>
         {children}
      </ChatSessionContext.Provider>
   );
}

export function useRecentThreads() {
   const queryClient = useQueryClient();
   const { data = [] } = useLiveQuery(
      (q) =>
         q
            .from({ t: getThreadsCollection(queryClient) })
            .orderBy(({ t }) => t.lastMessageAt, "desc")
            .limit(5),
      [queryClient],
   );
   return data;
}
