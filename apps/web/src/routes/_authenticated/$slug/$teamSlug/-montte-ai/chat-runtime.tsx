import {
   useAui,
   useAuiState,
   type ThreadMessage,
   type ThreadMessageLike,
} from "@assistant-ui/react";
import {
   AssistantRuntimeProvider,
   useRemoteThreadListRuntime,
} from "@assistant-ui/core/react";
import { fromThreadMessageLike } from "@assistant-ui/core/internal";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import type { AgUiAssistantRuntime } from "@assistant-ui/react-ag-ui";
import {
   HttpAgent,
   RunAgentInputSchema,
   type AgentSubscriber,
   type RunAgentParameters,
   type RunAgentResult,
} from "@ag-ui/client";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useEffect, useMemo } from "react";
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
import type {
   RemoteThreadListAdapter,
   RemoteThreadMetadata,
   RemoteThreadListResponse,
} from "@assistant-ui/core";
import type { AssistantStream } from "assistant-stream";
import { toast } from "@packages/ui/hooks/use-toast";
import { createPersistedStore } from "@/lib/store";
import { client, orpc, type Outputs } from "@/integrations/orpc/client";

type ChatMessage = Outputs["threads"]["getById"]["messages"][number];

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

const scopeStore = createPersistedStore<{ id: AgentScopeId }>(
   "montte:chat:scope",
   { id: "auto" },
);

const forwardedPropsSchema = z.record(z.string(), z.unknown()).catch({});
let activeAgUiRuntime: AgUiAssistantRuntime | null = null;

export const selectScope = (id: AgentScopeId) =>
   scopeStore.setState(() => ({ id }));

export const useSelectedScope = (): AgentScope => {
   const id = useStore(scopeStore, (s) => s.id);
   return SCOPES.find((scope) => scope.id === id) ?? AUTO_SCOPE;
};

function pickPageContext(): ChatPageContext | undefined {
   const scope = SCOPES.find((item) => item.id === scopeStore.state.id);
   return scope?.skillHint ? { skillHint: scope.skillHint } : undefined;
}

class MontteHttpAgent extends HttpAgent {
   constructor(private initialThreadId: string | undefined) {
      super({ threadId: initialThreadId, url: "/api/chat" });
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
      if (this.initialThreadId) return this.initialThreadId;
      const thread = await client.threads.create({}).catch(() => null);
      if (thread === null) {
         toast.error("Falha ao criar conversa.");
         throw new Error("Falha ao criar conversa.");
      }
      this.initialThreadId = thread.id;
      this.threadId = thread.id;
      return thread.id;
   }
}

function jsonPartResult(value: unknown): unknown {
   if (typeof value !== "string") return value;
   return z.json().catch(value).parse(value);
}

function contentToString(value: unknown): string {
   if (typeof value === "string") return value;
   if (!Array.isArray(value)) return JSON.stringify(value);
   return value
      .map((part) => {
         if (
            typeof part === "object" &&
            part !== null &&
            "text" in part &&
            typeof part.text === "string"
         ) {
            return part.text;
         }
         return JSON.stringify(part);
      })
      .join("\n");
}

function convertMessageLike(message: ChatMessage): ThreadMessageLike {
   const toolResults = new Map<string, { content: string; error?: string }>();
   for (const part of message.parts) {
      if (part.type !== "tool-result") continue;
      toolResults.set(part.toolCallId, {
         content: contentToString(part.content),
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

function convertMessage(message: ChatMessage): ThreadMessage {
   return fromThreadMessageLike(convertMessageLike(message), message.id, {
      type: "complete",
      reason: "unknown",
   });
}

function createEmptyAssistantStream(): AssistantStream {
   return new ReadableStream({
      start(controller) {
         controller.close();
      },
   });
}

function toThreadMetadata(
   thread: Awaited<ReturnType<typeof client.threads.list>>["threads"][number],
): RemoteThreadMetadata {
   return {
      status: "regular",
      remoteId: thread.id,
      externalId: thread.id,
      title: thread.title ?? undefined,
      custom: {
         createdAt: thread.createdAt,
         lastMessageAt: thread.lastMessageAt,
      },
   };
}

function createThreadListAdapter(): RemoteThreadListAdapter {
   return {
      async list(): Promise<RemoteThreadListResponse> {
         const data = await client.threads.list({ limit: 50 });
         return { threads: data.threads.map(toThreadMetadata) };
      },
      async fetch(threadId: string): Promise<RemoteThreadMetadata> {
         const data = await client.threads.getById({ threadId });
         if (data.thread === null) throw new Error("Thread not found");
         return toThreadMetadata(data.thread);
      },
      async initialize(): Promise<{ remoteId: string; externalId: string }> {
         const thread = await client.threads.create({});
         return { remoteId: thread.id, externalId: thread.id };
      },
      async rename(threadId: string, title: string): Promise<void> {
         await client.threads.update({ threadId, title });
      },
      async archive(): Promise<void> {},
      async unarchive(): Promise<void> {},
      async delete(threadId: string): Promise<void> {
         await client.threads.remove({ threadId });
      },
      async generateTitle(): Promise<AssistantStream> {
         return createEmptyAssistantStream();
      },
   };
}

function useRouteThreadId() {
   return useRouterState({
      select: (state) => {
         const match = state.location.pathname.match(/\/chat\/([^/]+)/);
         const threadId = match?.[1];
         if (!threadId || threadId === "new") return undefined;
         return threadId;
      },
   });
}

function useMontteAgUiRuntime(): AgUiAssistantRuntime {
   const posthog = usePostHog();
   const remoteThreadId = useAuiState((s) => s.threadListItem.remoteId);
   const isMainThread = useAuiState(
      (s) => s.threads.mainThreadId === s.threadListItem.id,
   );
   const agent = useMemo(
      () => new MontteHttpAgent(remoteThreadId),
      [remoteThreadId],
   );
   const history = useMemo(
      () => ({
         load: async () => {
            if (!remoteThreadId) return { messages: [] };
            const data = await client.threads.getById({
               threadId: remoteThreadId,
            });
            if (data.thread === null) return { messages: [] };
            const messages = data.messages.map(convertMessage);
            return {
               messages: messages.map((message, index) => ({
                  message,
                  parentId:
                     index > 0 ? (messages[index - 1]?.id ?? null) : null,
               })),
            };
         },
         append: async () => {},
      }),
      [remoteThreadId],
   );

   const runtime = useAgUiRuntime({
      agent,
      showThinking: true,
      onError: () => toast.error("Falha no streaming da Montte AI."),
      adapters: {
         history,
         feedback: {
            submit: ({ message, type }) => {
               if (message.role !== "assistant") return;
               posthog.capture("ai_agent_message_feedback", {
                  feedback_type: type,
                  message_id: message.id,
                  message_role: "assistant",
                  thread_id: remoteThreadId,
                  content_part_count: message.content.length,
               });
            },
         },
      },
   });

   useEffect(() => {
      if (!isMainThread) return;
      activeAgUiRuntime = runtime;
      return () => {
         if (activeAgUiRuntime === runtime) activeAgUiRuntime = null;
      };
   }, [isMainThread, runtime]);

   return runtime;
}

function ChatRuntimeEffects() {
   const remoteThreadId = useAuiState((s) => s.threadListItem.remoteId);
   const isRunning = useAuiState((s) => s.thread.isRunning);
   const aui = useAui();

   useEffect(() => {
      if (isRunning) return;
      if (!remoteThreadId) return;
      void aui.threads().reload();
   }, [aui, isRunning, remoteThreadId]);

   return null;
}

export function ChatSessionProvider({
   children,
}: {
   children: React.ReactNode;
}) {
   const routeThreadId = useRouteThreadId();
   const threadListAdapter = useMemo(() => createThreadListAdapter(), []);
   const runtime = useRemoteThreadListRuntime({
      adapter: threadListAdapter,
      runtimeHook: useMontteAgUiRuntime,
      threadId: routeThreadId,
   });

   return (
      <AssistantRuntimeProvider runtime={runtime}>
         <ChatRuntimeEffects />
         {children}
      </AssistantRuntimeProvider>
   );
}

export function useMontteSuggestions() {
   const remoteThreadId = useAuiState((s) => s.threadListItem.remoteId);
   const suggestionsQueryOptions = orpc.threads.getById.queryOptions({
      input: {
         threadId: remoteThreadId ?? "00000000-0000-0000-0000-000000000000",
      },
      enabled: remoteThreadId !== undefined,
      select: (data) => data.thread?.suggestions ?? [],
   });

   const { data } = useQuery(suggestionsQueryOptions);
   return data ?? [];
}

export function useCurrentRemoteThreadId() {
   return useAuiState((s) => s.threadListItem.remoteId);
}

export function useMontteActions() {
   const aui = useAui();
   const remoteThreadId = useCurrentRemoteThreadId();

   return useMemo(
      () => ({
         startNewConversation: () => void aui.threads().switchToNewThread(),
         stop: () => void aui.thread().cancelRun(),
         deleteMessage: async (messageId: string) => {
            if (!remoteThreadId) return;
            const removed = await client.threads
               .removeMessage({ threadId: remoteThreadId, messageId })
               .catch(() => null);
            if (removed === null) {
               toast.error("Falha ao excluir mensagem.");
               return;
            }
            try {
               const data = await client.threads.getById({
                  threadId: remoteThreadId,
               });
               aui.thread().reset(data.messages.map(convertMessage));
            } catch {
               toast.error("Falha ao recarregar conversa.");
            }
         },
         approveTool: (id: string) =>
            activeAgUiRuntime?.unstable_submitInterruptResponses([
               {
                  interruptId: id,
                  status: "resolved",
                  payload: { approved: true },
               },
            ]),
         rejectTool: (id: string) =>
            activeAgUiRuntime?.unstable_submitInterruptResponses([
               { interruptId: id, status: "cancelled" },
            ]),
      }),
      [aui, remoteThreadId],
   );
}

export function useMontteIsRunning() {
   return useAuiState((s) => s.thread.isRunning);
}

export function useMonttePendingApprovals() {
   useAuiState((s) => s.thread.isRunning);
   return (
      activeAgUiRuntime
         ?.unstable_getPendingInterrupts()
         .map((interrupt) => interrupt.id) ?? []
   );
}
