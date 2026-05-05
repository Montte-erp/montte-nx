import { useSuspenseQuery } from "@tanstack/react-query";
import { createStore, shallow, useStore } from "@tanstack/react-store";
import {
   stream as aiStream,
   useChat,
   type UIMessage,
} from "@tanstack/ai-react";
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
type AgentSyncMessagesInput = Inputs["threads"]["syncMessages"];

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

const SCOPE_IDS: AgentScopeId[] = [
   "auto",
   "servicos",
   "contatos",
   "categorias",
   "estoque",
   "financeiro",
   "analises",
];

const SUGGESTION_IDS: AgentScopeId[] = [
   "servicos",
   "contatos",
   "financeiro",
   "categorias",
   "estoque",
   "analises",
];

export const SCOPES: AgentScope[] = SCOPE_IDS.map((id) => ({
   id,
   ...SCOPE_BY_ID[id],
}));

export const SCOPE_SUGGESTIONS: AgentScope[] = SUGGESTION_IDS.map((id) => ({
   id,
   ...SCOPE_BY_ID[id],
}));

interface ChatState {
   activeThreadId: AgentSendInput["threadId"] | null;
   seedMessages: UIMessage[];
   pageContext: AgentSendInput["pageContext"];
   scopeOpen: boolean;
}

export const chatStore = createStore<ChatState>({
   activeThreadId: null,
   seedMessages: [],
   pageContext: undefined,
   scopeOpen: false,
});

const scopeStore = createPersistedStore<{ id: AgentScopeId }>(
   "montte:chat:scope",
   { id: "auto" },
);

export const setActiveThread = (
   threadId: AgentSendInput["threadId"],
   messages: UIMessage[],
) =>
   chatStore.setState((s) => ({
      ...s,
      activeThreadId: threadId,
      seedMessages: messages,
   }));

export const resetChat = () =>
   chatStore.setState(() => ({
      activeThreadId: null,
      seedMessages: [],
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

export const loadThread = async (threadId: AgentSendInput["threadId"]) => {
   const result = await fromPromise(
      client.threads.getById({ threadId }),
      () => null,
   );
   if (result.isErr()) {
      toast.error("Falha ao carregar conversa.");
      return;
   }
   setActiveThread(result.value.thread.id, result.value.messages);
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

   const input: AgentSendInput = {
      threadId: activeThreadId,
      pageContext,
      messages: messages.flatMap((message) =>
         "parts" in message ? [message] : [],
      ),
   };
   const response = await client.agent.send(input);
   yield* response;
});

async function syncAgentMessages(messages: UIMessage[], errorMessage?: string) {
   const { activeThreadId } = chatStore.state;
   if (activeThreadId === null || messages.length === 0) return;

   const input: AgentSyncMessagesInput = {
      threadId: activeThreadId,
      messages,
   };
   const result = await fromPromise(
      client.threads.syncMessages(input),
      () => null,
   );
   if (result.isErr() && errorMessage !== undefined) {
      toast.error(errorMessage);
      return;
   }
   if (result.isErr()) return;
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

export interface ChatSession {
   messages: UIMessage[];
   status: "ready" | "submitted" | "streaming" | "error";
   isStreaming: boolean;
   isSubmitting: boolean;
   pendingApprovalIds: string[];
   sendMessage: (text: string) => Promise<void>;
   approveTool: (approvalId: string) => Promise<void>;
   rejectTool: (approvalId: string) => Promise<void>;
   approveAll: () => Promise<void>;
   rejectAll: () => Promise<void>;
}

export function useChatSession(): ChatSession {
   const seedMessages = useStore(chatStore, (s) => s.seedMessages, shallow);

   const chat = useChat({
      connection: agentConnection,
      initialMessages: seedMessages,
      onFinish: () => {
         void syncAgentMessages(
            chat.messages,
            "Falha ao salvar resposta da Montte AI.",
         );
      },
      onError: () => {
         void syncAgentMessages(chat.messages);
         toast.error("Falha no streaming da Montte AI.");
      },
   });

   const status = chat.status;
   const approvalIds = pendingApprovalIds(chat.messages);

   return {
      messages: chat.messages,
      status,
      isStreaming: status === "streaming",
      isSubmitting: status === "submitted",
      pendingApprovalIds: approvalIds,
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

         const result = await fromPromise(
            (async () => {
               let threadId = chatStore.state.activeThreadId;
               if (threadId === null) {
                  const created = await client.threads.create({
                     title: trimmed.slice(0, 80),
                  });
                  threadId = created.id;
               }
               const skillHint = SCOPE_BY_ID[scopeStore.state.id].skillHint;
               chatStore.setState((s) => ({
                  ...s,
                  activeThreadId: threadId,
                  pageContext: skillHint ? { skillHint } : s.pageContext,
               }));
               await chat.sendMessage(trimmed);
            })(),
            () => null,
         );
         if (result.isErr()) {
            toast.error("Falha ao enviar mensagem.");
         }
      },
   };
}

export function useRecentThreads() {
   const query = useSuspenseQuery(
      orpc.threads.list.queryOptions({ input: { limit: 5 } }),
   );
   return query.data.threads;
}
