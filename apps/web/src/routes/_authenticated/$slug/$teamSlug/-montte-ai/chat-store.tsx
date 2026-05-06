import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createStore, useStore } from "@tanstack/react-store";
import { useLiveQuery } from "@tanstack/react-db";
import {
   fetchServerSentEvents,
   useChat,
   type UIMessage,
} from "@tanstack/ai-react";
import { createContext, useContext, useMemo } from "react";
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
import { client, orpc } from "@/integrations/orpc/client";
import type { MessageMetadata } from "@core/database/schemas/messages";
import type { PageContext } from "@modules/agents/constants";
import {
   getMessagesCollection,
   getThreadCollection,
   refreshThreadCollections,
} from "./chat-collections";

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

const SCOPE_BY_ID: Record<AgentScopeId, Omit<AgentScope, "id">> = {
   auto: { label: "Auto", icon: Sparkles },
   servicos: { label: "Serviços", icon: Briefcase, skillHint: "services" },
   contatos: { label: "Contatos", icon: Contact },
   categorias: { label: "Centro de Custo", icon: FolderTree },
   estoque: { label: "Estoque", icon: Tag },
   financeiro: { label: "Financeiro", icon: Wallet },
   analises: { label: "Análises", icon: Gauge },
};

const SCOPE_ORDER: AgentScopeId[] = [
   "auto",
   "servicos",
   "contatos",
   "categorias",
   "estoque",
   "financeiro",
   "analises",
];

export const SCOPES: AgentScope[] = SCOPE_ORDER.map((id) => ({
   id,
   ...SCOPE_BY_ID[id],
}));

export const SCOPE_SUGGESTIONS: AgentScope[] = SCOPE_ORDER.filter(
   (id) => id !== "auto",
).map((id) => ({ id, ...SCOPE_BY_ID[id] }));

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

type PendingSend = {
   text?: string;
   regenerate?: boolean;
   replaceFromMessageId?: string;
};

let pendingSend: PendingSend | null = null;

export const setActiveThread = (threadId: string | null) =>
   chatStore.setState((s) => ({ ...s, activeThreadId: threadId }));

export const resetChat = () =>
   chatStore.setState((s) => ({ ...s, activeThreadId: null }));

export const togglePanel = () =>
   chatStore.setState((s) => ({ ...s, panelOpen: !s.panelOpen }));

export const setPanelOpen = (panelOpen: boolean) =>
   chatStore.setState((s) => ({ ...s, panelOpen }));

export const selectScope = (id: AgentScopeId) =>
   scopeStore.setState(() => ({ id }));

export const useActiveThreadId = () =>
   useStore(chatStore, (s) => s.activeThreadId);

export const usePanelOpen = () => useStore(chatStore, (s) => s.panelOpen);

export const useSelectedScope = (): AgentScope => {
   const id = useStore(scopeStore, (s) => s.id);
   return { id, ...SCOPE_BY_ID[id] };
};

function pickPageContext(): PageContext | undefined {
   const skillHint = SCOPE_BY_ID[scopeStore.state.id].skillHint;
   return skillHint ? { skillHint } : undefined;
}

const agentConnection = fetchServerSentEvents("/api/chat", () => {
   const send = pendingSend;
   pendingSend = null;
   const { activeThreadId } = chatStore.state;
   return {
      credentials: "include",
      body: {
         threadId: activeThreadId ?? "",
         ...(send?.text !== undefined && { text: send.text }),
         ...(send?.regenerate && { regenerate: true }),
         ...(send?.replaceFromMessageId && {
            replaceFromMessageId: send.replaceFromMessageId,
         }),
         pageContext: pickPageContext(),
      },
   };
});

export interface ChatSession {
   messages: UIMessage[];
   suggestions: string[];
   status: "ready" | "submitted" | "streaming" | "error";
   error: Error | null;
   isStreaming: boolean;
   isSubmitting: boolean;
   pendingApprovalIds: string[];
   metadataFor: (messageId: string) => MessageMetadata | null | undefined;
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

export function ChatSessionProvider({
   children,
}: {
   children: React.ReactNode;
}) {
   const queryClient = useQueryClient();
   const threadId = useActiveThreadId();

   const chat = useChat({
      connection: agentConnection,
      initialMessages: [],
      onFinish: async () => {
         const id = chatStore.state.activeThreadId;
         if (!id) return;
         await Promise.all([
            getMessagesCollection(id, queryClient).utils.refetch(),
            getThreadCollection(id, queryClient).utils.refetch(),
            queryClient.invalidateQueries({
               queryKey: orpc.threads.list.key(),
            }),
         ]);
         chat.setMessages([]);
      },
      onError: () => toast.error("Falha no streaming da Montte AI."),
   });

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
            ? q.from({ t: getThreadCollection(threadId, queryClient) })
            : null,
      [threadId, queryClient],
   );
   const thread = threadRows[0];

   const status = chat.status;

   const session = useMemo<ChatSession>(() => {
      const dbIds = new Set(dbMessages.map((m) => m.id));
      const overlay = chat.messages.filter((m) => !dbIds.has(m.id));
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

      const ensureThread = async (
         firstText: string,
      ): Promise<string | null> => {
         const existing = chatStore.state.activeThreadId;
         if (existing !== null) return existing;
         const result = await fromPromise(
            client.threads.create({ title: firstText.slice(0, 80) }),
            () => null,
         );
         if (result.isErr()) {
            toast.error("Falha ao criar conversa.");
            return null;
         }
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
            const id = await ensureThread(trimmed);
            if (id === null) return;
            pendingSend = { text: trimmed };
            await chat.sendMessage(trimmed);
         },
         regenerateFrom: async (userMessageId) => {
            if (status === "streaming") return;
            const idx = messages.findIndex((m) => m.id === userMessageId);
            if (idx < 0) return;
            chat.setMessages(messages.slice(0, idx + 1));
            pendingSend = { regenerate: true };
            await chat.reload();
         },
         editAndResend: async (userMessageId, text) => {
            if (status === "streaming") return;
            const trimmed = text.trim();
            if (!trimmed) return;
            const idx = messages.findIndex((m) => m.id === userMessageId);
            if (idx < 0) return;
            chat.setMessages(messages.slice(0, idx));
            pendingSend = {
               text: trimmed,
               replaceFromMessageId: userMessageId,
            };
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
            refreshThreadCollections(id);
         },
      };
   }, [chat, status, dbMessages, thread]);

   return (
      <ChatSessionContext.Provider value={session}>
         {children}
      </ChatSessionContext.Provider>
   );
}

export function useRecentThreads() {
   const query = useSuspenseQuery(
      orpc.threads.list.queryOptions({ input: { limit: 5 } }),
   );
   return query.data.threads;
}

export { refreshThreadCollections };
