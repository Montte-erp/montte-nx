import {
   AssistantRuntimeProvider,
   type AppendMessage,
   type ThreadMessageLike,
   useExternalStoreRuntime,
} from "@assistant-ui/react";
import { stream, useChat } from "@tanstack/ai-react";
import { useLiveQuery } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";
import { createStore } from "@tanstack/store";
import { shallow, useStore } from "@tanstack/react-store";
import type { UIMessage } from "@tanstack/ai-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import {
   FolderTree,
   Gauge,
   Sparkles,
   Tag,
   Wallet,
   type LucideIcon,
} from "lucide-react";
import dayjs from "dayjs";
import { toast } from "@packages/ui/hooks/use-toast";
import { createPersistedStore } from "@/lib/store";
import { client } from "@/integrations/orpc/client";
import {
   type ChatMessage,
   getThreadCollection,
   getThreadsCollection,
   refreshChatData,
} from "./chat-data";

type ChatMessageMetadata = ChatMessage["metadata"];
type ChatPageContext = NonNullable<
   NonNullable<ChatMessageMetadata>["pageContext"]
>;
type UiMessagePart = UIMessage["parts"][number];

export type AgentScopeId =
   | "auto"
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
   threadId: string;
   runId: string;
   text?: string;
   regenerate?: boolean;
   replaceFromMessageId?: string;
   pageContext?: ChatPageContext;
};

interface MontteAssistantActions {
   startNewConversation: () => void;
   stop: () => void;
   deleteMessage: (messageId: string) => Promise<void>;
   approveTool: (approvalId: string) => Promise<void>;
   rejectTool: (approvalId: string) => Promise<void>;
}

interface MontteAssistantState extends MontteAssistantActions {
   messageCount: number;
   isRunning: boolean;
   pendingApprovalIds: string[];
}

const initialMontteAssistantActions: MontteAssistantActions = {
   startNewConversation: () => {},
   stop: () => {},
   deleteMessage: async () => {},
   approveTool: async () => {},
   rejectTool: async () => {},
};

const montteAssistantStore = createStore<MontteAssistantState>({
   messageCount: 0,
   isRunning: false,
   pendingApprovalIds: [],
   ...initialMontteAssistantActions,
});

export const useMontteMessageCount = () =>
   useStore(montteAssistantStore, (s) => s.messageCount);

export const useMontteIsRunning = () =>
   useStore(montteAssistantStore, (s) => s.isRunning);

export const useMonttePendingApprovals = () =>
   useStore(montteAssistantStore, (s) => s.pendingApprovalIds);

export const useMontteActions = () =>
   useStore(
      montteAssistantStore,
      (s) => ({
         startNewConversation: s.startNewConversation,
         stop: s.stop,
         deleteMessage: s.deleteMessage,
         approveTool: s.approveTool,
         rejectTool: s.rejectTool,
      }),
      shallow,
   );

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
   let changed = false;
   const nextParts = next.parts.map((part, index) => {
      if (part.type !== "thinking") return part;
      const previousPart = previous.parts[index];
      const shouldKeepPrevious =
         previousPart?.type === "thinking" &&
         previousPart.content.length > part.content.length;
      if (shouldKeepPrevious) {
         changed = true;
         return previousPart;
      }
      return part;
   });

   if (nextParts.some(isNonEmptyThinkingPart)) {
      if (!changed) return next;
      return { ...next, parts: nextParts };
   }
   if (previousThinking.length === 0) return next;

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

function collapseAdjacentAssistantMessages(messages: UIMessage[]): UIMessage[] {
   const collapsed: UIMessage[] = [];
   for (const message of messages) {
      const previous = collapsed.at(-1);
      if (previous?.role === "assistant" && message.role === "assistant") {
         collapsed[collapsed.length - 1] = {
            ...previous,
            parts: [...previous.parts, ...message.parts],
         };
         continue;
      }
      collapsed.push(message);
   }
   return collapsed;
}

function convertMessage(message: UIMessage): ThreadMessageLike {
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
   const activeTurnThreadId = useRef<string | null>(null);
   const loadedSnapshotKey = useRef<string | null>(null);
   const visibleMessages = useRef<UIMessage[]>([]);

   const createTurn = useCallback(
      (
         overrides: Omit<ChatTurnRequest, "threadId" | "runId"> & {
            threadId?: string;
         },
      ) => {
         const thread = overrides.threadId ?? chatStore.state.activeThreadId;
         if (thread === null) return;
         const runId =
            typeof crypto.randomUUID === "function"
               ? crypto.randomUUID()
               : `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
         const next: ChatTurnRequest = {
            threadId: thread,
            runId,
            pageContext: pickPageContext(),
            ...overrides,
         };
         pendingTurn.current = next;
         activeTurnThreadId.current = thread;
         return next;
      },
      [],
   );

   const connection = useMemo(
      () =>
         stream(() => {
            const turn = pendingTurn.current;
            pendingTurn.current = null;
            if (turn === null) {
               return {
                  async *[Symbol.asyncIterator]() {},
               };
            }
            return (async function* () {
               const iterator = await client.threads.chat({
                  threadId: turn.threadId,
                  runId: turn.runId,
                  messages: [],
                  state: {},
                  context: [],
                  tools: [],
                  forwardedProps: {
                     ...(turn.text !== undefined && { text: turn.text }),
                     ...(turn.replaceFromMessageId !== undefined && {
                        replaceFromMessageId: turn.replaceFromMessageId,
                     }),
                     ...(turn.regenerate && { regenerate: true }),
                     ...(turn.pageContext !== undefined && {
                        pageContext: turn.pageContext,
                     }),
                  },
               });
               for await (const event of iterator) {
                  yield event;
               }
            })();
         }),
      [],
   );

   const chat = useChat({
      connection,
      initialMessages: [],
      onFinish: () => {
         const turnThreadId = activeTurnThreadId.current;
         activeTurnThreadId.current = null;
         if (turnThreadId === null) return;
         void (async () => {
            const id = turnThreadId;
            const wasActiveThread = chatStore.state.activeThreadId;
            try {
               await refreshChatData(queryClient, id);
            } catch {
               if (wasActiveThread !== id) return;
               setActiveThread(null);
               loadedSnapshotKey.current = null;
               visibleMessages.current = [];
               chat.setMessages([]);
            }
         })();
      },
      onError: () => toast.error("Falha no streaming da Montte AI."),
   });

   const { data: threadBundles } = useLiveQuery(
      (q) => {
         if (threadId === null) return undefined;
         return q.from({ bundle: getThreadCollection(threadId, queryClient) });
      },
      [queryClient, threadId],
   );
   const threadBundle = threadBundles?.[0];

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
         visibleMessages.current = [];
         chat.setMessages([]);
         return;
      }
      if (activeTurn) return;
      if (threadBundles === undefined) return;
      if (threadBundle === undefined) {
         loadedSnapshotKey.current = null;
         visibleMessages.current = [];
         chat.setMessages([]);
         return;
      }
      const messages = threadBundle.messages.map(toUiMessage);
      const snapshotKey = `${threadId}:${messages
         .map((message) => message.id)
         .join(":")}`;
      if (loadedSnapshotKey.current === snapshotKey) return;
      loadedSnapshotKey.current = snapshotKey;
      chat.setMessages(messages);
   }, [
      activeTurn,
      chat,
      chat.messages.length,
      threadBundle,
      threadBundles,
      threadId,
   ]);

   const messages = useMemo(() => {
      const merged = mergeStreamingMessages(
         visibleMessages.current,
         chat.messages,
         activeTurn,
      );
      const collapsed = collapseAdjacentAssistantMessages(merged);
      visibleMessages.current = collapsed;
      return collapsed;
   }, [activeTurn, chat.messages]);
   const approvalIds = useMemo(() => pendingApprovalIds(messages), [messages]);

   const ensureThread = useCallback(async (): Promise<string | null> => {
      const existing = chatStore.state.activeThreadId;
      if (existing !== null) return existing;
      const thread = await client.threads.create({}).catch(() => null);
      if (thread === null) {
         toast.error("Falha ao criar conversa.");
         return null;
      }
      void refreshChatData(queryClient);
      setActiveThread(thread.id);
      return thread.id;
   }, [queryClient]);

   const onNew = useCallback(
      async (message: AppendMessage) => {
         const text = messageText(message);
         if (!text || activeTurn) return;
         const id = await ensureThread();
         if (id === null) return;
         createTurn({ threadId: id, text });
         await chat.sendMessage(text);
      },
      [activeTurn, chat, createTurn, ensureThread],
   );

   const onEdit = useCallback(
      async (message: AppendMessage) => {
         const text = messageText(message);
         if (!text || activeTurn) return;
         const id = await ensureThread();
         if (id === null) return;
         createTurn({
            threadId: id,
            text,
            replaceFromMessageId:
               message.sourceId ?? message.parentId ?? undefined,
         });
         await chat.sendMessage(text);
      },
      [activeTurn, chat, createTurn, ensureThread],
   );

   const onReload = useCallback(async () => {
      if (activeTurn) return;
      const thread = chatStore.state.activeThreadId;
      if (thread === null) return;
      createTurn({ regenerate: true });
      await chat.reload();
   }, [activeTurn, chat, createTurn]);

   const startNewConversation = useCallback(() => {
      pendingTurn.current = null;
      activeTurnThreadId.current = null;
      loadedSnapshotKey.current = null;
      visibleMessages.current = [];
      chat.setMessages([]);
      setActiveThread(null);
   }, [chat]);

   const stop = useCallback(() => chat.stop(), [chat]);

   const deleteMessage = useCallback(
      async (messageId: string) => {
         const id = chatStore.state.activeThreadId;
         if (!id) return;
         const removed = await client.threads
            .removeMessage({ threadId: id, messageId })
            .catch(() => null);
         if (removed === null) {
            toast.error("Falha ao excluir mensagem.");
            return;
         }
         await refreshChatData(queryClient, id);
      },
      [queryClient],
   );

   const approveTool = useCallback(
      (id: string) => chat.addToolApprovalResponse({ id, approved: true }),
      [chat],
   );

   const rejectTool = useCallback(
      (id: string) => chat.addToolApprovalResponse({ id, approved: false }),
      [chat],
   );

   const runtime = useExternalStoreRuntime<UIMessage>({
      messages,
      isRunning: activeTurn,
      isDisabled: false,
      suggestions: (threadBundle?.thread.suggestions ?? []).map((prompt) => ({
         prompt,
      })),
      convertMessage,
      onNew,
      onEdit,
      onReload,
      onCancel: async () => chat.stop(),
      adapters: {
         feedback: {
            submit: ({ message, type }) => {
               if (message.role !== "assistant") return;
               posthog.capture("ai_agent_message_feedback", {
                  feedback_type: type,
                  message_id: message.id,
                  message_role: "assistant",
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

   useEffect(() => {
      montteAssistantStore.setState((s) => ({
         ...s,
         messageCount: messages.length,
         isRunning: activeTurn,
         pendingApprovalIds: approvalIds,
         startNewConversation,
         stop,
         deleteMessage,
         approveTool,
         rejectTool,
      }));
   }, [
      activeTurn,
      approvalIds,
      approveTool,
      deleteMessage,
      messages.length,
      rejectTool,
      startNewConversation,
      stop,
   ]);

   return (
      <AssistantRuntimeProvider runtime={runtime}>
         {children}
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
