import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createStore, useStore } from "@tanstack/react-store";
import {
   stream as aiStream,
   useChat,
   type UIMessage,
} from "@tanstack/ai-react";
import { createContext, Suspense, useContext } from "react";
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
import type { MessageMetadata } from "@core/database/schemas/messages";

type AgentSendInput = Inputs["agent"]["send"];
type PageContext = AgentSendInput["pageContext"];

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

type RequestOverride = {
   regenerate?: boolean;
   replaceFromMessageId?: string;
};

let pendingOverride: RequestOverride | null = null;

export const setActiveThread = (threadId: string | null) =>
   chatStore.setState((s) => ({ ...s, activeThreadId: threadId }));

export const resetChat = () =>
   chatStore.setState((s) => ({ ...s, activeThreadId: null }));

export const togglePanel = () =>
   chatStore.setState((s) => ({ ...s, panelOpen: !s.panelOpen }));

export const setPanelOpen = (panelOpen: boolean) =>
   chatStore.setState((s) => ({ ...s, panelOpen }));

export const selectScope = (id: AgentScopeId) => {
   scopeStore.setState(() => ({ id }));
};

export const useActiveThreadId = () =>
   useStore(chatStore, (s) => s.activeThreadId);

export const usePanelOpen = () => useStore(chatStore, (s) => s.panelOpen);

export const useSelectedScope = (): AgentScope => {
   const id = useStore(scopeStore, (s) => s.id);
   return { id, ...SCOPE_BY_ID[id] };
};

function pickPageContext(): PageContext {
   const skillHint = SCOPE_BY_ID[scopeStore.state.id].skillHint;
   return skillHint ? { skillHint } : undefined;
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

const agentConnection = aiStream(async function* (messagesArg) {
   const { activeThreadId } = chatStore.state;
   if (activeThreadId === null) return;

   const uiMessages = messagesArg.flatMap((m) => ("parts" in m ? [m] : []));

   const override = pendingOverride;
   pendingOverride = null;

   const text = override?.regenerate
      ? undefined
      : (lastUserText(uiMessages) ?? undefined);

   const response = await client.agent.send({
      threadId: activeThreadId,
      ...(text !== undefined && { text }),
      ...(override?.replaceFromMessageId && {
         replaceFromMessageId: override.replaceFromMessageId,
      }),
      ...(override?.regenerate && { regenerate: true }),
      pageContext: pickPageContext(),
   });
   yield* response;
});

export interface ChatSession {
   messages: UIMessage[];
   status: "ready" | "submitted" | "streaming" | "error";
   error: Error | null;
   isStreaming: boolean;
   isSubmitting: boolean;
   pendingApprovalIds: string[];
   metadataFor: (messageId: string) => MessageMetadata | null | undefined;
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
   const session = useSessionImpl([], {});
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
   const session = useSessionImpl(data.messages, data.messageMetadata);
   return (
      <ChatSessionContext.Provider value={session}>
         {children}
      </ChatSessionContext.Provider>
   );
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

function useSessionImpl(
   initialMessages: UIMessage[],
   initialMetadata: Record<string, MessageMetadata | null>,
): ChatSession {
   const queryClient = useQueryClient();

   const chat = useChat({
      connection: agentConnection,
      initialMessages,
      onFinish: () => {
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
      chatStore.setState((s) => ({ ...s, activeThreadId: threadId }));
      return threadId;
   };

   return {
      messages: chat.messages,
      status,
      error: chat.error ?? null,
      isStreaming: status === "streaming",
      isSubmitting: status === "submitted",
      pendingApprovalIds: approvalIds,
      metadataFor: (id) => initialMetadata[id],
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
         pendingOverride = null;
         await chat.sendMessage(trimmed);
      },
      regenerate: async () => {
         if (status === "streaming") return;
         const lastUserIdx = (() => {
            for (let i = chat.messages.length - 1; i >= 0; i--) {
               if (chat.messages[i]?.role === "user") return i;
            }
            return -1;
         })();
         if (lastUserIdx < 0) return;
         const lastText = lastUserText(chat.messages);
         if (lastText === null) return;
         chat.setMessages(chat.messages.slice(0, lastUserIdx + 1));
         pendingOverride = { regenerate: true };
         await chat.sendMessage(lastText);
      },
      editAndResend: async (messageId, text) => {
         if (status === "streaming") return;
         const trimmed = text.trim();
         if (!trimmed) return;
         const idx = chat.messages.findIndex((m) => m.id === messageId);
         if (idx < 0) return;
         chat.setMessages(chat.messages.slice(0, idx));
         pendingOverride = { replaceFromMessageId: messageId };
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
