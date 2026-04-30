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
import {
   dbMessagesToUIMessages,
   pendingApprovalIds,
   textPartContent,
   uiMessagesOnly,
   uiMessagesToThreadMessages,
} from "@modules/agents/messages";
import {
   client,
   orpc,
   type Inputs,
   type Outputs,
} from "@/integrations/orpc/client";

type RubiSendInput = Inputs["rubi"]["send"];
type RubiSyncMessagesInput = Inputs["threads"]["syncMessages"];
export type RubiThreadDetails = Outputs["threads"]["getById"];
export type RubiThreadSummary = Outputs["threads"]["list"]["threads"][number];

interface RubiScopeDefinition {
   label: string;
   icon: LucideIcon;
   skillHint?: string;
}

export const RUBI_SCOPES_BY_ID: Record<RubiScopeId, RubiScopeDefinition> = {
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

export const RUBI_SCOPE_IDS: RubiScopeId[] = [
   "auto",
   "servicos",
   "contatos",
   "categorias",
   "estoque",
   "financeiro",
   "analises",
];

export const RUBI_SUGGESTION_IDS: RubiScopeId[] = [
   "servicos",
   "contatos",
   "financeiro",
   "categorias",
   "estoque",
   "analises",
];

export interface RubiPageContext {
   skillHint?: string;
   route?: string;
   title?: string;
}

export interface RubiChatState {
   activeThreadId: RubiSendInput["threadId"] | null;
   composerValue: string;
   isStreaming: boolean;
   messages: UIMessage[];
   pageContext: RubiSendInput["pageContext"];
   pendingApprovalIds: string[];
   scopeOpen: boolean;
   selectedScopeId: RubiScopeId;
}

export const rubiChatStore = createStore<RubiChatState>({
   activeThreadId: null,
   composerValue: "",
   isStreaming: false,
   messages: [],
   pageContext: undefined,
   pendingApprovalIds: [],
   scopeOpen: false,
   selectedScopeId: "auto",
});

const rubiConnection = aiStream(async function* (messages) {
   const { activeThreadId, pageContext } = rubiChatStore.state;
   if (activeThreadId === null) return;

   const input: RubiSendInput = {
      threadId: activeThreadId,
      pageContext,
      messages: uiMessagesOnly(messages),
   };
   const response = await client.rubi.send(input);
   yield* response;
});

async function syncRubiMessages(messages: UIMessage[], errorMessage?: string) {
   const { activeThreadId } = rubiChatStore.state;
   if (activeThreadId === null || messages.length === 0) return;

   const input: RubiSyncMessagesInput = {
      threadId: activeThreadId,
      messages: uiMessagesToThreadMessages(messages),
   };
   const result = await fromPromise(
      client.threads.syncMessages(input),
      () => null,
   );
   if (result.isErr() && errorMessage !== undefined) {
      toast.error(errorMessage);
   }
}

function startRubiThread(
   threadId: RubiSendInput["threadId"],
   pageContext: RubiSendInput["pageContext"],
) {
   rubiChatStore.setState((state) => ({
      ...state,
      activeThreadId: threadId,
      pageContext,
   }));
}

export function setRubiComposerValue(composerValue: string) {
   rubiChatStore.setState((state) => ({ ...state, composerValue }));
}

export function setRubiScopeOpen(scopeOpen: boolean) {
   rubiChatStore.setState((state) => ({ ...state, scopeOpen }));
}

export function selectRubiScope(selectedScopeId: RubiScopeId) {
   rubiChatStore.setState((state) => ({
      ...state,
      selectedScopeId,
      scopeOpen: false,
   }));
}

export function resetRubiChat() {
   rubiChatStore.setState(() => ({
      activeThreadId: null,
      composerValue: "",
      isStreaming: false,
      messages: [],
      pageContext: undefined,
      pendingApprovalIds: [],
      scopeOpen: false,
      selectedScopeId: "auto",
   }));
}

export function loadRubiThread(thread: RubiThreadDetails) {
   const messages = dbMessagesToUIMessages(thread.messages);
   rubiChatStore.setState((state) => ({
      ...state,
      activeThreadId: thread.thread.id,
      messages,
      pageContext: undefined,
      pendingApprovalIds: pendingApprovalIds(messages),
   }));
   return messages;
}

export function rubiRecentThreadsQueryOptions() {
   return orpc.threads.list.queryOptions({ input: { limit: 5 } });
}

export function approveRubiTool(id: string) {
   return { id, approved: true };
}

export function rejectRubiTool(id: string) {
   return { id, approved: false };
}

export function getRubiUserMessageText(message: UIMessage) {
   return message.parts
      .flatMap((part) => {
         const content = textPartContent(part);
         return content === null ? [] : [content];
      })
      .join("");
}

export function setRubiPageContext(pageContext: RubiPageContext) {
   rubiChatStore.setState((state) => ({
      ...state,
      pageContext,
   }));
}

export function useRubiChat() {
   const state = useStore(
      rubiChatStore,
      (value) => ({
         activeThreadId: value.activeThreadId,
         composerValue: value.composerValue,
         isStreaming: value.isStreaming,
         messages: value.messages,
         pendingApprovalIds: value.pendingApprovalIds,
         scopeOpen: value.scopeOpen,
         selectedScopeId: value.selectedScopeId,
      }),
      shallow,
   );

   const recentsQuery = useSuspenseQuery(rubiRecentThreadsQueryOptions());
   const chat = useChat({
      connection: rubiConnection,
      initialMessages: state.messages,
      onFinish: () => {
         rubiChatStore.setState((value) => ({
            ...value,
            messages: chat.messages,
            pendingApprovalIds: pendingApprovalIds(chat.messages),
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
            pendingApprovalIds: pendingApprovalIds(chat.messages),
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
            await chat.addToolApprovalResponse(approveRubiTool(id));
         }
      },
      approveTool: (id: string) =>
         chat.addToolApprovalResponse(approveRubiTool(id)),
      getUserMessageText: getRubiUserMessageText,
      loadThread: async (threadId: RubiSendInput["threadId"]) => {
         const result = await fromPromise(
            client.threads.getById({ threadId }),
            () => null,
         );
         if (result.isErr()) {
            toast.error("Falha ao carregar conversa.");
            return;
         }
         chat.setMessages(loadRubiThread(result.value));
      },
      rejectAll: async () => {
         for (const id of approvalIds) {
            await chat.addToolApprovalResponse(rejectRubiTool(id));
         }
      },
      rejectTool: (id: string) =>
         chat.addToolApprovalResponse(rejectRubiTool(id)),
      reset: () => {
         resetRubiChat();
         chat.clear();
      },
      selectScope: selectRubiScope,
      sendMessage: async () => {
         const { composerValue, isStreaming, selectedScopeId } =
            rubiChatStore.state;
         const text = composerValue.trim();
         if (!text || isStreaming || chat.isLoading) return;
         setRubiComposerValue("");
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
               startRubiThread(threadId, pageContext);
               await chat.sendMessage(text);
               rubiChatStore.setState((value) => ({
                  ...value,
                  messages: chat.messages,
                  pendingApprovalIds: pendingApprovalIds(chat.messages),
               }));
            })(),
            () => null,
         );
         if (result.isErr()) {
            toast.error("Falha ao enviar mensagem.");
         }
      },
      setComposerValue: setRubiComposerValue,
      setScopeOpen: setRubiScopeOpen,
   };
}
