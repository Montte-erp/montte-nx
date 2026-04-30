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

type RubiSendInput = Inputs["rubi"]["send"];
type RubiSyncMessagesInput = Inputs["threads"]["syncMessages"];

interface RubiScopeDefinition {
   label: string;
   icon: LucideIcon;
   skillHint?: string;
}

const RUBI_SCOPES_BY_ID: Record<RubiScopeId, RubiScopeDefinition> = {
   auto: { label: "Auto", icon: Sparkles },
   servicos: { label: "Serviços", icon: Briefcase, skillHint: "services" },
   contatos: { label: "Contatos", icon: Contact },
   categorias: { label: "Centro de Custo", icon: FolderTree },
   estoque: { label: "Estoque", icon: Tag },
   financeiro: { label: "Financeiro", icon: Wallet },
   analises: { label: "Análises", icon: Gauge },
};

export type RubiScopeId =
   | "auto"
   | "servicos"
   | "contatos"
   | "categorias"
   | "estoque"
   | "financeiro"
   | "analises";

const RUBI_SCOPE_IDS: RubiScopeId[] = [
   "auto",
   "servicos",
   "contatos",
   "categorias",
   "estoque",
   "financeiro",
   "analises",
];

const RUBI_SUGGESTION_IDS: RubiScopeId[] = [
   "servicos",
   "contatos",
   "financeiro",
   "categorias",
   "estoque",
   "analises",
];

interface RubiChatState {
   activeThreadId: RubiSendInput["threadId"] | null;
   composerValue: string;
   messages: UIMessage[];
   pageContext: RubiSendInput["pageContext"];
   scopeOpen: boolean;
   selectedScopeId: RubiScopeId;
}

const rubiChatStore = createStore<RubiChatState>({
   activeThreadId: null,
   composerValue: "",
   messages: [],
   pageContext: undefined,
   scopeOpen: false,
   selectedScopeId: "auto",
});

const rubiConnection = aiStream(async function* (messages) {
   const { activeThreadId, pageContext } = rubiChatStore.state;
   if (activeThreadId === null) return;

   const input: RubiSendInput = {
      threadId: activeThreadId,
      pageContext,
      messages: messages.flatMap((message) =>
         "parts" in message ? [message] : [],
      ),
   };
   const response = await client.rubi.send(input);
   yield* response;
});

async function syncRubiMessages(messages: UIMessage[], errorMessage?: string) {
   const { activeThreadId } = rubiChatStore.state;
   if (activeThreadId === null || messages.length === 0) return;

   const input: RubiSyncMessagesInput = {
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

export function useRubiChat() {
   const state = useStore(
      rubiChatStore,
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
      connection: rubiConnection,
      initialMessages: state.messages,
      onFinish: () => {
         rubiChatStore.setState((value) => ({
            ...value,
            messages: chat.messages,
         }));
         void syncRubiMessages(
            chat.messages,
            "Falha ao salvar resposta da Rubi.",
         );
      },
      onError: () => {
         rubiChatStore.setState((value) => ({
            ...value,
            messages: chat.messages,
         }));
         void syncRubiMessages(chat.messages);
         toast.error("Falha no streaming da Rubi.");
      },
   });
   const approvalIds = pendingApprovalIds(chat.messages);
   const selectedScope = RUBI_SCOPES_BY_ID[state.selectedScopeId];
   const scopes = RUBI_SCOPE_IDS.map((id) => ({
      id,
      ...RUBI_SCOPES_BY_ID[id],
   }));
   const suggestions = RUBI_SUGGESTION_IDS.map((id) => ({
      id,
      ...RUBI_SCOPES_BY_ID[id],
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
      loadThread: async (threadId: RubiSendInput["threadId"]) => {
         const result = await fromPromise(
            client.threads.getById({ threadId }),
            () => null,
         );
         if (result.isErr()) {
            toast.error("Falha ao carregar conversa.");
            return;
         }
         rubiChatStore.setState((value) => ({
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
         rubiChatStore.setState(() => ({
            activeThreadId: null,
            composerValue: "",
            messages: [],
            pageContext: undefined,
            scopeOpen: false,
            selectedScopeId: "auto",
         }));
         chat.clear();
      },
      selectScope: (selectedScopeId: RubiScopeId) => {
         rubiChatStore.setState((value) => ({
            ...value,
            selectedScopeId,
            scopeOpen: false,
         }));
      },
      sendMessage: async () => {
         const { composerValue, selectedScopeId } = rubiChatStore.state;
         const text = composerValue.trim();
         if (!text || chat.isLoading) return;
         rubiChatStore.setState((value) => ({
            ...value,
            composerValue: "",
         }));
         const result = await fromPromise(
            (async () => {
               let threadId = rubiChatStore.state.activeThreadId;
               if (threadId === null) {
                  const created = await client.threads.create({
                     title: text.slice(0, 80),
                  });
                  threadId = created.id;
               }

               const activeScope = RUBI_SCOPES_BY_ID[selectedScopeId];
               const pageContext =
                  activeScope.skillHint === undefined
                     ? undefined
                     : { skillHint: activeScope.skillHint };
               rubiChatStore.setState((state) => ({
                  ...state,
                  activeThreadId: threadId,
                  pageContext,
               }));
               await chat.sendMessage(text);
               rubiChatStore.setState((value) => ({
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
         rubiChatStore.setState((value) => ({ ...value, composerValue }));
      },
      setScopeOpen: (scopeOpen: boolean) => {
         rubiChatStore.setState((value) => ({ ...value, scopeOpen }));
      },
   };
}
