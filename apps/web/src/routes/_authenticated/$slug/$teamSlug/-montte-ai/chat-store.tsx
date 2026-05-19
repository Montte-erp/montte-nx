import {
   type ThreadMessageLike,
   useAui,
   useAuiState,
} from "@assistant-ui/react";
import { AssistantRuntimeProvider } from "@assistant-ui/core/react";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import type { AgUiAssistantRuntime } from "@assistant-ui/react-ag-ui";
import {
   HttpAgent,
   RunAgentInputSchema,
   type AgentSubscriber,
   type RunAgentParameters,
   type RunAgentResult,
} from "@ag-ui/client";
import { useLiveQuery } from "@tanstack/react-db";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createStore } from "@tanstack/store";
import { shallow, useStore } from "@tanstack/react-store";
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
import { z } from "zod";
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
   {
      id: "categorias",
      label: "Centro de Custo",
      icon: FolderTree,
      skillHint: "financeiro",
   },
   { id: "estoque", label: "Estoque", icon: Tag },
   {
      id: "financeiro",
      label: "Financeiro",
      icon: Wallet,
      skillHint: "financeiro",
   },
   {
      id: "analises",
      label: "Análises",
      icon: Gauge,
      skillHint: "financeiro",
   },
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

const suggestionsStore = createStore<{ suggestions: string[] }>({
   suggestions: [],
});

const uuidSchema = z.string().uuid();
const forwardedPropsSchema = z.record(z.string(), z.unknown()).catch({});

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

export const useMontteSuggestions = () =>
   useStore(suggestionsStore, (s) => s.suggestions);

function pickPageContext(): ChatPageContext | undefined {
   const scope = SCOPES.find((item) => item.id === scopeStore.state.id);
   return scope?.skillHint ? { skillHint: scope.skillHint } : undefined;
}

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

class MontteHttpAgent extends HttpAgent {
   constructor(private readonly queryClient: QueryClient) {
      super({ url: "/api/chat" });
   }

   override async runAgent(
      parameters?: RunAgentParameters,
      subscriber?: AgentSubscriber,
   ): Promise<RunAgentResult> {
      const input = RunAgentInputSchema.parse(parameters);
      const threadId = await this.ensureThread();
      const forwardedProps = forwardedPropsSchema.parse(input.forwardedProps);
      this.threadId = threadId;
      this.setMessages(input.messages);
      this.setState(input.state);
      return super.runAgent(
         {
            runId: input.runId,
            tools: input.tools,
            context: input.context,
            forwardedProps: {
               ...forwardedProps,
               pageContext: pickPageContext(),
            },
         },
         subscriber,
      );
   }

   private async ensureThread(): Promise<string> {
      const activeThreadId = chatStore.state.activeThreadId;
      const activeThread = uuidSchema.safeParse(activeThreadId);
      if (activeThread.success) return activeThread.data;

      const thread = await client.threads.create({}).catch(() => null);
      if (thread === null) {
         toast.error("Falha ao criar conversa.");
         throw new Error("Falha ao criar conversa.");
      }

      void refreshChatData(this.queryClient, thread.id);
      setActiveThread(thread.id);
      return thread.id;
   }
}

function jsonPartResult(value: unknown): unknown {
   if (typeof value !== "string") return value;
   return z.json().catch(value).parse(value);
}

function convertMessage(message: ChatMessage): ThreadMessageLike {
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
         result: part.output ?? jsonPartResult(result?.content),
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
      createdAt: dayjs(message.createdAt).toDate(),
   };
}

function ChatRuntimeBridge({
   queryClient,
   runtime,
}: {
   queryClient: QueryClient;
   runtime: AgUiAssistantRuntime;
}) {
   const aui = useAui();
   const threadId = useActiveThreadId();
   const loadedSnapshotKey = useRef<string | null>(null);
   const wasRunning = useRef(false);
   const messages = useAuiState((s) => s.thread.messages);
   const isRunning = useAuiState((s) => s.thread.isRunning);
   const pendingApprovalIds = runtime
      .unstable_getPendingInterrupts()
      .map((interrupt) => interrupt.id);
   const { data: threadBundles } = useLiveQuery(
      (q) => {
         if (threadId === null) return undefined;
         return q.from({ bundle: getThreadCollection(threadId, queryClient) });
      },
      [queryClient, threadId],
   );
   const threadBundle = threadBundles?.[0];

   useEffect(() => {
      if (threadId === null) {
         loadedSnapshotKey.current = null;
         suggestionsStore.setState(() => ({ suggestions: [] }));
         aui.thread().reset([]);
         return;
      }
      if (isRunning) return;
      if (threadBundles === undefined) return;
      if (threadBundle === undefined) return;

      const importedMessages = threadBundle.messages.map(convertMessage);
      const snapshotKey = `${threadId}:${importedMessages
         .map((message) => message.id)
         .join(":")}`;
      if (loadedSnapshotKey.current === snapshotKey) return;
      loadedSnapshotKey.current = snapshotKey;
      suggestionsStore.setState(() => ({
         suggestions: threadBundle.thread.suggestions ?? [],
      }));
      aui.thread().reset(importedMessages);
   }, [aui, isRunning, threadBundle, threadBundles, threadId]);

   useEffect(() => {
      if (isRunning) {
         wasRunning.current = true;
         return;
      }
      if (!wasRunning.current) return;
      wasRunning.current = false;
      const id = chatStore.state.activeThreadId;
      if (!id) return;
      void refreshChatData(queryClient, id);
   }, [isRunning, queryClient]);

   const startNewConversation = useCallback(() => {
      aui.thread().reset([]);
      setActiveThread(null);
   }, [aui]);

   const stop = useCallback(() => aui.thread().cancelRun(), [aui]);

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
      (id: string) =>
         runtime.unstable_submitInterruptResponses([
            {
               interruptId: id,
               status: "resolved",
               payload: { approved: true },
            },
         ]),
      [runtime],
   );

   const rejectTool = useCallback(
      (id: string) =>
         runtime.unstable_submitInterruptResponses([
            { interruptId: id, status: "cancelled" },
         ]),
      [runtime],
   );

   useEffect(() => {
      montteAssistantStore.setState((s) => ({
         ...s,
         messageCount: messages.length,
         isRunning,
         pendingApprovalIds,
         startNewConversation,
         stop,
         deleteMessage,
         approveTool,
         rejectTool,
      }));
   }, [
      approveTool,
      deleteMessage,
      isRunning,
      messages.length,
      pendingApprovalIds,
      rejectTool,
      startNewConversation,
      stop,
   ]);

   return null;
}

export function ChatSessionProvider({
   children,
}: {
   children: React.ReactNode;
}) {
   const queryClient = useQueryClient();
   const posthog = usePostHog();
   const agent = useMemo(() => new MontteHttpAgent(queryClient), [queryClient]);
   const runtime = useAgUiRuntime({
      agent,
      showThinking: true,
      onError: () => toast.error("Falha no streaming da Montte AI."),
      adapters: {
         feedback: {
            submit: ({ message, type }) => {
               if (message.role !== "assistant") return;
               posthog.capture("ai_agent_message_feedback", {
                  feedback_type: type,
                  message_id: message.id,
                  message_role: "assistant",
                  thread_id: chatStore.state.activeThreadId,
                  content_part_count: message.content.length,
               });
            },
         },
      },
   });

   return (
      <AssistantRuntimeProvider runtime={runtime}>
         <ChatRuntimeBridge queryClient={queryClient} runtime={runtime} />
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
