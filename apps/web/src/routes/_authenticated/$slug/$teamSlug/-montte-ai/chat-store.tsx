import {
   AssistantRuntimeProvider,
   type AppendMessage,
   type ThreadMessageLike,
   useExternalStoreRuntime,
} from "@assistant-ui/react";
import { fetchHttpStream, useChat } from "@tanstack/ai-react";
import { useLiveQuery } from "@tanstack/react-db";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStore, useStore } from "@tanstack/react-store";
import type { UIMessage } from "@tanstack/ai-react";
import {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useRef,
} from "react";
import { usePostHog } from "posthog-js/react";
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
import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { toast } from "sonner";
import { createPersistedStore } from "@/lib/store";
import { client } from "@/integrations/orpc/client";
import {
   type ChatMessage,
   getThreadsCollection,
   refreshChatData,
   removeMessageFromChatData,
   writeThreadSnapshot,
} from "./chat-data";
import { useAgentLive } from "./use-agent-live";

type ChatMessageMetadata = ChatMessage["metadata"];
type ChatPageContext = NonNullable<
   NonNullable<ChatMessageMetadata>["pageContext"]
>;
type UiMessagePart = UIMessage["parts"][number];

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
   return SCOPES.find((scope) => scope.id === id) ?? AUTO_SCOPE;
};

function pickPageContext(): ChatPageContext | undefined {
   const scope = SCOPES.find((item) => item.id === scopeStore.state.id);
   return scope?.skillHint ? { skillHint: scope.skillHint } : undefined;
}

export type ChatTurnRequest = {
   text?: string;
   regenerate?: boolean;
   replaceFromMessageId?: string;
};

interface MontteAssistantContextValue {
   messageCount: number;
   isRunning: boolean;
   pendingApprovalIds: string[];
   startNewConversation: () => void;
   stop: () => void;
   deleteMessage: (messageId: string) => Promise<void>;
   approveTool: (approvalId: string) => Promise<void>;
   rejectTool: (approvalId: string) => Promise<void>;
}

const MontteAssistantContext =
   createContext<MontteAssistantContextValue | null>(null);

export function useMontteAssistant() {
   const ctx = useContext(MontteAssistantContext);
   if (ctx === null) {
      throw new Error(
         "useMontteAssistant must be inside <ChatSessionProvider>",
      );
   }
   return ctx;
}

function toUiMessage(message: ChatMessage): UIMessage {
   return {
      id: message.id,
      role: message.role,
      parts: message.parts,
      createdAt: dayjs(message.createdAt).toDate(),
   };
}

function messageText(message: AppendMessage): string {
   return message.content
      .flatMap((part) => {
         if (part.type !== "text") return [];
         return [part.text];
      })
      .join("\n\n")
      .trim();
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

function hasPendingToolWork(messages: UIMessage[]): boolean {
   return messages.some((message) => {
      if (message.role !== "assistant") return false;
      const resultIds = new Set(
         message.parts.flatMap((part) =>
            part.type === "tool-result" ? [part.toolCallId] : [],
         ),
      );
      return message.parts.some((part) => {
         if (part.type !== "tool-call") return false;
         if (
            part.state === "approval-requested" &&
            part.approval?.approved === undefined
         )
            return true;
         return part.output === undefined && !resultIds.has(part.id);
      });
   });
}

function isNonEmptyThinkingPart(part: UiMessagePart): boolean {
   return part.type === "thinking" && part.content.trim().length > 0;
}

function mergeStreamingMessage(
   previous: UIMessage | undefined,
   next: UIMessage,
): UIMessage {
   if (previous === undefined) return next;
   if (next.role !== "assistant") return next;

   const previousThinking = previous.parts.filter(isNonEmptyThinkingPart);
   const nextParts = next.parts.map((part, index) => {
      if (part.type !== "thinking") return part;
      const previousPart = previous.parts[index];
      if (
         previousPart?.type === "thinking" &&
         previousPart.content.length > part.content.length
      )
         return previousPart;
      return part;
   });

   if (nextParts.some(isNonEmptyThinkingPart)) {
      return { ...next, parts: nextParts };
   }
   if (previousThinking.length === 0) return { ...next, parts: nextParts };

   const firstTextIndex = nextParts.findIndex((part) => part.type === "text");
   const insertAt = firstTextIndex === -1 ? nextParts.length : firstTextIndex;

   return {
      ...next,
      parts: [
         ...nextParts.slice(0, insertAt),
         ...previousThinking,
         ...nextParts.slice(insertAt),
      ],
   };
}

function mergeStreamingMessages(
   previousMessages: UIMessage[],
   nextMessages: UIMessage[],
   activeTurn: boolean,
): UIMessage[] {
   if (!activeTurn) return nextMessages;

   const previousById = new Map(
      previousMessages.map((message) => [message.id, message]),
   );
   return nextMessages.map((message) =>
      mergeStreamingMessage(previousById.get(message.id), message),
   );
}

function convertMessage(
   message: UIMessage,
   runningMessageId: string | null,
): ThreadMessageLike {
   const toolResults = new Map<string, { content: string; error?: string }>();
   for (const part of message.parts) {
      if (part.type !== "tool-result") continue;
      toolResults.set(part.toolCallId, {
         content: part.content,
         ...(part.error && { error: part.error }),
      });
   }

   type ThreadMessageContentPart = Exclude<
      ThreadMessageLike["content"],
      string
   >[number];
   const content: ThreadMessageContentPart[] = [];
   for (const part of message.parts) {
      if (part.type === "text") {
         content.push({ type: "text", text: part.content });
         continue;
      }
      if (part.type === "thinking") {
         if (part.content.trim().length === 0) continue;
         content.push({ type: "reasoning", text: part.content });
         continue;
      }
      if (part.type !== "tool-call") continue;
      const result = toolResults.get(part.id);
      content.push({
         type: "tool-call",
         toolCallId: part.id,
         toolName: part.name,
         argsText: part.arguments,
         result: part.output ?? result?.content,
         isError: result?.error !== undefined,
         artifact: {
            state: part.state,
            approvalId: part.approval?.id,
            approvalApproved: part.approval?.approved,
         },
      });
   }

   return {
      id: message.id,
      role: message.role,
      content,
      createdAt: message.createdAt,
      ...(message.role === "assistant" && {
         status:
            runningMessageId === message.id
               ? { type: "running" }
               : { type: "complete", reason: "stop" },
      }),
   };
}

export function ChatSessionProvider({
   children,
}: {
   children: React.ReactNode;
}) {
   const queryClient = useQueryClient();
   const posthog = usePostHog();
   const threadId = useActiveThreadId();
   const pendingTurn = useRef<ChatTurnRequest | null>(null);
   const loadedSnapshotKey = useRef<string | null>(null);
   const visibleMessages = useRef<UIMessage[]>([]);

   useAgentLive();

   const connection = useMemo(
      () =>
         fetchHttpStream("/api/chat", () => {
            const turn = pendingTurn.current;
            pendingTurn.current = null;
            return {
               credentials: "include",
               body: {
                  threadId: chatStore.state.activeThreadId ?? "",
                  ...(turn?.text !== undefined && { text: turn.text }),
                  ...(turn?.regenerate && { regenerate: true }),
                  ...(turn?.replaceFromMessageId && {
                     replaceFromMessageId: turn.replaceFromMessageId,
                  }),
                  pageContext: pickPageContext(),
               },
            };
         }),
      [],
   );

   const chat = useChat({
      connection,
      initialMessages: [],
      onFinish: () => {
         const id = chatStore.state.activeThreadId;
         if (!id) return;
         void fromPromise(client.threads.getById({ threadId: id }), () => null)
            .then((result) => {
               if (result.isErr()) return;
               const messages = result.value.messages.map(toUiMessage);
               const snapshotKey = `${id}:${messages
                  .map((message) => message.id)
                  .join(":")}`;
               loadedSnapshotKey.current = snapshotKey;
               chat.setMessages(messages);
               writeThreadSnapshot(queryClient, {
                  ...result.value.thread,
                  suggestions: result.value.thread.suggestions ?? [],
               });
            })
            .then(() => refreshChatData(queryClient));
      },
      onError: () => toast.error("Falha no streaming da Montte AI."),
   });

   const threadQuery = useQuery(
      threadId === null
         ? {
              queryKey: ["chat-thread-runtime", null],
              queryFn: skipToken,
           }
         : {
              queryKey: ["chat-thread-runtime", threadId],
              queryFn: () => client.threads.getById({ threadId }),
           },
   );

   const status = chat.status;
   const activeTurn =
      chat.isLoading ||
      chat.sessionGenerating ||
      status === "submitted" ||
      status === "streaming" ||
      hasPendingToolWork(chat.messages);

   useEffect(() => {
      if (threadId === null) {
         if (loadedSnapshotKey.current === null && chat.messages.length === 0)
            return;
         loadedSnapshotKey.current = null;
         chat.setMessages([]);
         return;
      }
      if (activeTurn) return;
      const data = threadQuery.data;
      if (data === undefined) return;
      const messages = data.messages.map(toUiMessage);
      const snapshotKey = `${threadId}:${messages
         .map((message) => message.id)
         .join(":")}`;
      if (loadedSnapshotKey.current === snapshotKey) return;
      loadedSnapshotKey.current = snapshotKey;
      chat.setMessages(messages);
      writeThreadSnapshot(queryClient, {
         ...data.thread,
         suggestions: data.thread.suggestions ?? [],
      });
   }, [
      activeTurn,
      chat,
      chat.messages.length,
      queryClient,
      threadId,
      threadQuery.data,
   ]);

   const messages = useMemo(() => {
      const merged = mergeStreamingMessages(
         visibleMessages.current,
         chat.messages,
         activeTurn,
      );
      visibleMessages.current = merged;
      return merged;
   }, [activeTurn, chat.messages]);
   const runningMessageId = activeTurn ? (messages.at(-1)?.id ?? null) : null;
   const approvalIds = useMemo(() => pendingApprovalIds(messages), [messages]);

   const ensureThread = useCallback(async (): Promise<string | null> => {
      const existing = chatStore.state.activeThreadId;
      if (existing !== null) return existing;
      const result = await fromPromise(client.threads.create({}), () => null);
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
   }, [queryClient]);

   const onNew = useCallback(
      async (message: AppendMessage) => {
         const text = messageText(message);
         if (!text || activeTurn) return;
         const id = await ensureThread();
         if (id === null) return;
         pendingTurn.current = { text };
         await chat.sendMessage(text);
      },
      [activeTurn, chat, ensureThread],
   );

   const onEdit = useCallback(
      async (message: AppendMessage) => {
         const text = messageText(message);
         if (!text || activeTurn) return;
         const id = await ensureThread();
         if (id === null) return;
         pendingTurn.current = {
            text,
            replaceFromMessageId: message.sourceId ?? message.parentId ?? "",
         };
         await chat.sendMessage(text);
      },
      [activeTurn, chat, ensureThread],
   );

   const onReload = useCallback(async () => {
      if (activeTurn) return;
      pendingTurn.current = { regenerate: true };
      await chat.reload();
   }, [activeTurn, chat]);

   const runtime = useExternalStoreRuntime<UIMessage>({
      messages,
      isRunning: activeTurn,
      isDisabled: false,
      suggestions: (threadQuery.data?.thread?.suggestions ?? []).map(
         (prompt) => ({ prompt }),
      ),
      convertMessage: (message) => convertMessage(message, runningMessageId),
      onNew,
      onEdit,
      onReload,
      onCancel: async () => chat.stop(),
      adapters: {
         feedback: {
            submit: ({ message, type }) => {
               posthog.capture("ai_agent_message_feedback", {
                  feedback_type: type,
                  message_id: message.id,
                  message_role: message.role,
                  thread_id: chatStore.state.activeThreadId,
                  content_part_count:
                     typeof message.content === "string"
                        ? 1
                        : message.content.length,
               });
            },
         },
      },
   });

   const context = useMemo<MontteAssistantContextValue>(
      () => ({
         messageCount: messages.length,
         isRunning: activeTurn,
         pendingApprovalIds: approvalIds,
         startNewConversation: () => {
            chat.setMessages([]);
            setActiveThread(null);
         },
         stop: () => chat.stop(),
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
         approveTool: (id) =>
            chat.addToolApprovalResponse({ id, approved: true }),
         rejectTool: (id) =>
            chat.addToolApprovalResponse({ id, approved: false }),
      }),
      [activeTurn, approvalIds, chat, messages.length, queryClient],
   );

   return (
      <AssistantRuntimeProvider runtime={runtime}>
         <MontteAssistantContext.Provider value={context}>
            {children}
         </MontteAssistantContext.Provider>
      </AssistantRuntimeProvider>
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
