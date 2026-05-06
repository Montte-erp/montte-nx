import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createStore, useStore } from "@tanstack/react-store";
import {
   stream as aiStream,
   useChat,
   type UIMessage,
} from "@tanstack/ai-react";
import { createContext, Suspense, useContext, useRef } from "react";
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
import { client, orpc, type Inputs } from "@/integrations/orpc/client";

type AgentSendInput = Inputs["agent"]["send"];

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

export const SCOPES: AgentScope[] = (
   [
      "auto",
      "servicos",
      "contatos",
      "categorias",
      "estoque",
      "financeiro",
      "analises",
   ] as AgentScopeId[]
).map((id) => ({ id, ...SCOPE_BY_ID[id] }));

export const SCOPE_SUGGESTIONS: AgentScope[] = (
   [
      "servicos",
      "contatos",
      "financeiro",
      "categorias",
      "estoque",
      "analises",
   ] as AgentScopeId[]
).map((id) => ({ id, ...SCOPE_BY_ID[id] }));

interface ChatState {
   activeThreadId: string | null;
   pageContext: AgentSendInput["pageContext"];
   scopeOpen: boolean;
}

const chatStore = createStore<ChatState>({
   activeThreadId: null,
   pageContext: undefined,
   scopeOpen: false,
});

const scopeStore = createPersistedStore<{ id: AgentScopeId }>(
   "montte:chat:scope",
   { id: "auto" },
);

export const setActiveThread = (threadId: string | null) =>
   chatStore.setState((s) => ({ ...s, activeThreadId: threadId }));

export const resetChat = () =>
   chatStore.setState(() => ({
      activeThreadId: null,
      pageContext: undefined,
      scopeOpen: false,
   }));

export const setPageContext = (pageContext: AgentSendInput["pageContext"]) =>
   chatStore.setState((s) => ({ ...s, pageContext }));

export const setScopeOpen = (scopeOpen: boolean) =>
   chatStore.setState((s) => ({ ...s, scopeOpen }));

export const selectScope = (id: AgentScopeId) => {
   scopeStore.setState(() => ({ id }));
   setScopeOpen(false);
};

export const useActiveThreadId = () =>
   useStore(chatStore, (s) => s.activeThreadId);

export const useScopeOpen = () => useStore(chatStore, (s) => s.scopeOpen);

export const useSelectedScope = (): AgentScope => {
   const id = useStore(scopeStore, (s) => s.id);
   return { id, ...SCOPE_BY_ID[id] };
};

const agentConnection = aiStream(async function* (messages) {
   const { activeThreadId, pageContext } = chatStore.state;
   if (activeThreadId === null) return;

   const response = await client.agent.send({
      threadId: activeThreadId,
      pageContext,
      messages: messages.flatMap((m) => ("parts" in m ? [m] : [])),
   });
   yield* response;
});

async function syncMessages(messages: UIMessage[], silent = false) {
   const { activeThreadId } = chatStore.state;
   if (activeThreadId === null || messages.length === 0) return;

   const result = await fromPromise(
      client.threads.syncMessages({ threadId: activeThreadId, messages }),
      () => null,
   );
   if (result.isErr()) {
      if (!silent) toast.error("Falha ao salvar resposta da Montte AI.");
      return;
   }
   void client.threads.updateTitle({ threadId: activeThreadId });
}

function pendingApprovalIds(messages: UIMessage[]) {
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

function lastUserText(messages: UIMessage[]): string | null {
   for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.role === "user") {
         return m.parts
            .flatMap((p) => (p.type === "text" ? [p.content] : []))
            .join("");
      }
   }
   return null;
}

export interface ChatSession {
   messages: UIMessage[];
   status: "ready" | "submitted" | "streaming" | "error";
   error: Error | null;
   isStreaming: boolean;
   isSubmitting: boolean;
   pendingApprovalIds: string[];
   traceIdFor: (messageId: string) => string | undefined;
   sendMessage: (text: string) => Promise<void>;
   stop: () => void;
   regenerate: () => Promise<void>;
   editAndResend: (messageId: string, text: string) => Promise<void>;
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

export function ChatSessionProvider({
   children,
}: {
   children: React.ReactNode;
}) {
   const activeThreadId = useActiveThreadId();
   return (
      <SessionInner
         activeThreadId={activeThreadId}
         key={activeThreadId ?? "new"}
      >
         {children}
      </SessionInner>
   );
}

function SessionInner({
   activeThreadId,
   children,
}: {
   activeThreadId: string | null;
   children: React.ReactNode;
}) {
   if (activeThreadId === null) {
      return <NoThreadSession>{children}</NoThreadSession>;
   }
   return (
      <Suspense fallback={<NoThreadSession>{children}</NoThreadSession>}>
         <ThreadSession threadId={activeThreadId}>{children}</ThreadSession>
      </Suspense>
   );
}

function NoThreadSession({ children }: { children: React.ReactNode }) {
   const session = useSessionImpl([]);
   return (
      <ChatSessionContext.Provider value={session}>
         {children}
      </ChatSessionContext.Provider>
   );
}

function ThreadSession({
   threadId,
   children,
}: {
   threadId: string;
   children: React.ReactNode;
}) {
   const { data } = useSuspenseQuery(
      orpc.threads.getById.queryOptions({ input: { threadId } }),
   );
   const session = useSessionImpl(data.messages);
   return (
      <ChatSessionContext.Provider value={session}>
         {children}
      </ChatSessionContext.Provider>
   );
}

function useSessionImpl(initialMessages: UIMessage[]): ChatSession {
   const queryClient = useQueryClient();
   const pendingTraceIdRef = useRef<string | null>(null);
   const traceIdsRef = useRef<Map<string, string>>(new Map());

   const chat = useChat({
      connection: agentConnection,
      initialMessages,
      onChunk: (chunk) => {
         if (chunk.type === "RUN_STARTED" && "runId" in chunk) {
            const runId = (chunk as { runId?: unknown }).runId;
            if (typeof runId === "string") pendingTraceIdRef.current = runId;
         }
      },
      onFinish: (message) => {
         if (
            message.role === "assistant" &&
            pendingTraceIdRef.current !== null
         ) {
            traceIdsRef.current.set(message.id, pendingTraceIdRef.current);
            pendingTraceIdRef.current = null;
         }
         void syncMessages(chat.messages);
         void queryClient.invalidateQueries({
            queryKey: orpc.threads.list.key(),
         });
         const id = chatStore.state.activeThreadId;
         if (id) {
            void queryClient.invalidateQueries({
               queryKey: orpc.threads.getById.key({ input: { threadId: id } }),
            });
         }
      },
      onError: () => {
         void syncMessages(chat.messages, true);
         toast.error("Falha no streaming da Montte AI.");
      },
   });

   const status = chat.status;
   const approvalIds = pendingApprovalIds(chat.messages);

   const ensureThread = async (firstText: string): Promise<string | null> => {
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
      const threadId = result.value.id;
      const skillHint = SCOPE_BY_ID[scopeStore.state.id].skillHint;
      chatStore.setState((s) => ({
         ...s,
         activeThreadId: threadId,
         pageContext: skillHint ? { skillHint } : s.pageContext,
      }));
      return threadId;
   };

   return {
      messages: chat.messages,
      status,
      error: chat.error ?? null,
      isStreaming: status === "streaming",
      isSubmitting: status === "submitted",
      pendingApprovalIds: approvalIds,
      traceIdFor: (id) => traceIdsRef.current.get(id),
      stop: () => chat.stop(),
      approveTool: (id) => chat.addToolApprovalResponse({ id, approved: true }),
      rejectTool: (id) => chat.addToolApprovalResponse({ id, approved: false }),
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
      sendMessage: async (text: string) => {
         const trimmed = text.trim();
         if (!trimmed || status === "streaming") return;
         const threadId = await ensureThread(trimmed);
         if (threadId === null) return;
         await chat.sendMessage(trimmed);
      },
      regenerate: async () => {
         if (status === "streaming") return;
         const last = lastUserText(chat.messages);
         if (last === null) return;
         const lastUserIdx = (() => {
            for (let i = chat.messages.length - 1; i >= 0; i--) {
               if (chat.messages[i]?.role === "user") return i;
            }
            return -1;
         })();
         if (lastUserIdx < 0) return;
         chat.setMessages(chat.messages.slice(0, lastUserIdx));
         await chat.sendMessage(last);
      },
      editAndResend: async (messageId, text) => {
         if (status === "streaming") return;
         const trimmed = text.trim();
         if (!trimmed) return;
         const idx = chat.messages.findIndex((m) => m.id === messageId);
         if (idx < 0) return;
         chat.setMessages(chat.messages.slice(0, idx));
         await chat.sendMessage(trimmed);
      },
   };
}

export function useRecentThreads() {
   const query = useSuspenseQuery(
      orpc.threads.list.queryOptions({ input: { limit: 5 } }),
   );
   return query.data.threads;
}
