import { useSuspenseQuery } from "@tanstack/react-query";
import { createStore } from "@tanstack/react-store";
import { shallow, useStore } from "@tanstack/react-store";
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
import { client, orpc, type Inputs } from "@/integrations/orpc/client";

type AgentSendInput = Inputs["agent"]["send"];
type AgentSyncMessagesInput = Inputs["threads"]["syncMessages"];

interface AgentScopeDefinition {
   label: string;
   icon: LucideIcon;
   skillHint?: string;
}

const AGENT_SCOPES_BY_ID: Record<AgentScopeId, AgentScopeDefinition> = {
   auto: { label: "Auto", icon: Sparkles },
   servicos: { label: "Serviços", icon: Briefcase, skillHint: "services" },
   contatos: { label: "Contatos", icon: Contact },
   categorias: { label: "Centro de Custo", icon: FolderTree },
   estoque: { label: "Estoque", icon: Tag },
   financeiro: { label: "Financeiro", icon: Wallet },
   analises: { label: "Análises", icon: Gauge },
};

export type AgentScopeId =
   | "auto"
   | "servicos"
   | "contatos"
   | "categorias"
   | "estoque"
   | "financeiro"
   | "analises";

const AGENT_SCOPE_IDS: AgentScopeId[] = [
   "auto",
   "servicos",
   "contatos",
   "categorias",
   "estoque",
   "financeiro",
   "analises",
];

const AGENT_SUGGESTION_IDS: AgentScopeId[] = [
   "servicos",
   "contatos",
   "financeiro",
   "categorias",
   "estoque",
   "analises",
];

interface AgentChatState {
   activeThreadId: AgentSendInput["threadId"] | null;
   composerValue: string;
   messages: UIMessage[];
   pageContext: AgentSendInput["pageContext"];
   scopeOpen: boolean;
   selectedScopeId: AgentScopeId;
}

const agentChatStore = createStore<AgentChatState>({
   activeThreadId: null,
   composerValue: "",
   messages: [],
   pageContext: undefined,
   scopeOpen: false,
   selectedScopeId: "auto",
});

const agentConnection = aiStream(async function* (messages) {
   const { activeThreadId, pageContext } = agentChatStore.state;
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
   const { activeThreadId } = agentChatStore.state;
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

export function useAgentChat() {
   const state = useStore(
      agentChatStore,
      (value) => ({
         activeThreadId: value.activeThreadId,
         composerValue: value.composerValue,
         messages: value.messages,
         scopeOpen: value.scopeOpen,
         selectedScopeId: value.selectedScopeId,
      }),
      shallow,
   );

   const recentsQuery = useSuspenseQuery(
      orpc.threads.list.queryOptions({ input: { limit: 5 } }),
   );
   const chat = useChat({
      connection: agentConnection,
      initialMessages: state.messages,
      onFinish: () => {
         agentChatStore.setState((value) => ({
            ...value,
            messages: chat.messages,
         }));
         void syncAgentMessages(
            chat.messages,
            "Falha ao salvar resposta da Montte AI.",
         );
      },
      onError: () => {
         agentChatStore.setState((value) => ({
            ...value,
            messages: chat.messages,
         }));
         void syncAgentMessages(chat.messages);
         toast.error("Falha no streaming da Montte AI.");
      },
   });
   const approvalIds = pendingApprovalIds(chat.messages);
   const selectedScope = AGENT_SCOPES_BY_ID[state.selectedScopeId];
   const scopes = AGENT_SCOPE_IDS.map((id) => ({
      id,
      ...AGENT_SCOPES_BY_ID[id],
   }));
   const suggestions = AGENT_SUGGESTION_IDS.map((id) => ({
      id,
      ...AGENT_SCOPES_BY_ID[id],
   }));

   return {
      ...state,
      hasConversation: chat.messages.length > 0,
      isStreaming: chat.isLoading,
      messages: chat.messages,
      pendingApprovalIds: approvalIds,
      recents: recentsQuery.data.threads,
      scopes,
      selectedScope: { id: state.selectedScopeId, ...selectedScope },
      suggestions,
      approveAll: async () => {
         for (const id of approvalIds) {
            await chat.addToolApprovalResponse({ id, approved: true });
         }
      },
      approveTool: (id: string) =>
         chat.addToolApprovalResponse({ id, approved: true }),
      loadThread: async (threadId: AgentSendInput["threadId"]) => {
         const result = await fromPromise(
            client.threads.getById({ threadId }),
            () => null,
         );
         if (result.isErr()) {
            toast.error("Falha ao carregar conversa.");
            return;
         }
         agentChatStore.setState((value) => ({
            ...value,
            activeThreadId: result.value.thread.id,
            messages: result.value.messages,
            pageContext: undefined,
         }));
         chat.setMessages(result.value.messages);
      },
      rejectAll: async () => {
         for (const id of approvalIds) {
            await chat.addToolApprovalResponse({ id, approved: false });
         }
      },
      rejectTool: (id: string) =>
         chat.addToolApprovalResponse({ id, approved: false }),
      reset: () => {
         agentChatStore.setState(() => ({
            activeThreadId: null,
            composerValue: "",
            messages: [],
            pageContext: undefined,
            scopeOpen: false,
            selectedScopeId: "auto",
         }));
         chat.clear();
      },
      selectScope: (selectedScopeId: AgentScopeId) => {
         agentChatStore.setState((value) => ({
            ...value,
            selectedScopeId,
            scopeOpen: false,
         }));
      },
      sendMessage: async () => {
         const { composerValue, selectedScopeId } = agentChatStore.state;
         const text = composerValue.trim();
         if (!text || chat.isLoading) return;
         agentChatStore.setState((value) => ({
            ...value,
            composerValue: "",
         }));
         const result = await fromPromise(
            (async () => {
               let threadId = agentChatStore.state.activeThreadId;
               if (threadId === null) {
                  const created = await client.threads.create({
                     title: text.slice(0, 80),
                  });
                  threadId = created.id;
               }

               const activeScope = AGENT_SCOPES_BY_ID[selectedScopeId];
               const pageContext =
                  activeScope.skillHint === undefined
                     ? undefined
                     : { skillHint: activeScope.skillHint };
               agentChatStore.setState((state) => ({
                  ...state,
                  activeThreadId: threadId,
                  pageContext,
               }));
               await chat.sendMessage(text);
               agentChatStore.setState((value) => ({
                  ...value,
                  messages: chat.messages,
               }));
            })(),
            () => null,
         );
         if (result.isErr()) {
            toast.error("Falha ao enviar mensagem.");
         }
      },
      setComposerValue: (composerValue: string) => {
         agentChatStore.setState((value) => ({ ...value, composerValue }));
      },
      setScopeOpen: (scopeOpen: boolean) => {
         agentChatStore.setState((value) => ({ ...value, scopeOpen }));
      },
   };
}
