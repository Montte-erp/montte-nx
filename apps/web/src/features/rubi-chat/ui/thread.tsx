import type { UIMessage } from "@tanstack/ai-react";
import type { ModelId } from "@core/agents/models";
import { AVAILABLE_MODELS } from "@core/agents/models";
import { MarkdownText } from "@packages/ui/components/assistant-ui/markdown-text";
import {
   type ModelOption,
   ModelSelector,
} from "@packages/ui/components/assistant-ui/model-selector";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import { useStore } from "@tanstack/react-store";
import { ArrowUpIcon, SparklesIcon, SquareIcon } from "lucide-react";
import type { FC, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
   chatContextStore,
   setChatModel,
} from "@/features/rubi-chat/stores/chat-context-store";
import type { useRubiChat } from "@/features/rubi-chat/hooks/use-rubi-chat";
import { type ContextItem, ContextPicker } from "./context-picker";
import { AgentCallTool } from "./tool-components/agent-call-tool";
import { DataNetworkRenderer } from "./tool-components/data-network-renderer";
import { EditorTool } from "./tool-components/editor-tool";
import { ReasoningDisplay } from "./tool-components/reasoning-display";
import { ResearchTool } from "./tool-components/research-tool";
import { SkillTool } from "./tool-components/skill-tool";

const MODEL_OPTIONS: ModelOption[] = Object.entries(AVAILABLE_MODELS).map(
   ([id, preset]) => ({
      id,
      name: preset.label,
      description: preset.provider,
   }),
);

export interface QuickSuggestion {
   label: string;
   prompt: string;
}

export type RubiToolProps = {
   toolName: string;
   argsText: string | undefined;
   status: { type: "running" | "complete" | "incomplete"; reason?: string };
   result: unknown;
};

type RubiToolComponent = FC<RubiToolProps>;

const TOOL_UI_REGISTRY: Record<string, RubiToolComponent> = {
   "agent-research-agent": AgentCallTool,
   "agent-writer-agent": AgentCallTool,
   "agent-seo-auditor-agent": AgentCallTool,
   "agent-reviewer-agent": AgentCallTool,
   "agent-content-agent": AgentCallTool,
   "write-content": EditorTool,
   analyzeContent: ResearchTool,
   replaceText: EditorTool,
   insertHeading: EditorTool,
   insertList: EditorTool,
   insertCodeBlock: EditorTool,
   insertTable: EditorTool,
   editTitle: EditorTool,
   editDescription: EditorTool,
   editKeywords: EditorTool,
   editSlug: EditorTool,
   webSearch: ResearchTool,
   serpAnalysis: ResearchTool,
   competitorContent: ResearchTool,
   contentGap: ResearchTool,
   relatedKeywords: ResearchTool,
   factFinder: ResearchTool,
   webCrawl: ResearchTool,
   researchCompleteness: ResearchTool,
   searchPreviousContent: ResearchTool,
   graphSearch: ResearchTool,
   seoScore: ResearchTool,
   readability: ResearchTool,
   keywordDensity: ResearchTool,
   contentStructure: ResearchTool,
   badPatterns: ResearchTool,
   titleMeta: ResearchTool,
   quickAnswerAnalysis: ResearchTool,
   imageSeo: ResearchTool,
   linkDensity: ResearchTool,
   duplicateContent: ResearchTool,
   toneAnalysis: ResearchTool,
   citation: ResearchTool,
   originality: ResearchTool,
   optimizeTitle: EditorTool,
   optimizeMeta: EditorTool,
   injectKeywords: EditorTool,
   addInternalLinks: EditorTool,
   addExternalLinks: EditorTool,
   improveReadability: EditorTool,
   generateQuickAnswer: EditorTool,
   createContent: EditorTool,
   updateContent: EditorTool,
   deleteContent: EditorTool,
   createDashboard: EditorTool,
   createForm: EditorTool,
   getInstructionMemories: ResearchTool,
   dateTool: ResearchTool,
   mastra_workspace_read_file: SkillTool,
   mastra_workspace_search: SkillTool,
   mastra_workspace_list_files: SkillTool,
};

function toToolStatus(state: string): RubiToolProps["status"] {
   if (
      state === "awaiting-input" ||
      state === "input-streaming" ||
      state === "input-complete" ||
      state === "approval-requested"
   ) {
      return { type: "running" };
   }
   return { type: "complete" };
}

export interface ThreadProps {
   chat: ReturnType<typeof useRubiChat>;
   teamId: string;
   welcomeTitle?: string;
   welcomeSubtitle?: string;
   welcomeIconUrl?: string;
   quickSuggestions?: QuickSuggestion[];
   recentThreadsSlot?: ReactNode;
}

export const Thread: FC<ThreadProps> = ({
   chat,
   welcomeTitle = "O que você quer criar?",
   welcomeSubtitle = "Pesquise, escreva, audite SEO ou revise conteúdos.",
   welcomeIconUrl,
   quickSuggestions,
   recentThreadsSlot,
}) => {
   const scrollAnchorRef = useRef<HTMLDivElement>(null);
   const isEmpty = chat.messages.length === 0;

   useEffect(() => {
      scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
   }, [chat.messages.length]);

   return (
      <div
         className="aui-root aui-thread-root @container flex h-full w-full flex-col bg-transparent"
         style={{ ["--thread-max-width" as string]: "44rem" }}
      >
         <div className="aui-thread-viewport relative flex flex-1 flex-col overflow-y-auto scroll-smooth">
            {isEmpty ? (
               <ThreadWelcome
                  iconUrl={welcomeIconUrl}
                  onSendSuggestion={chat.sendMessage}
                  quickSuggestions={quickSuggestions}
                  recentThreadsSlot={recentThreadsSlot}
                  subtitle={welcomeSubtitle}
                  title={welcomeTitle}
               />
            ) : (
               <div className="flex flex-col">
                  {chat.messages.map((msg) => {
                     if (msg.role === "user") {
                        return <UserMessage key={msg.id} message={msg} />;
                     }
                     if (msg.role === "assistant") {
                        return <AssistantMessage key={msg.id} message={msg} />;
                     }
                     return null;
                  })}
               </div>
            )}
            <div ref={scrollAnchorRef} />
         </div>

         <div className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 overflow-visible rounded-t-3xl bg-transparent pb-4">
            <Composer chat={chat} />
         </div>
      </div>
   );
};

export function formatTimeAgo(date: Date | string): string {
   const d = typeof date === "string" ? new Date(date) : date;
   const diffMs = Date.now() - d.getTime();
   const diffDays = Math.floor(diffMs / 86400000);
   if (diffDays === 0) return "hoje";
   if (diffDays === 1) return "ontem";
   if (diffDays < 7) return `${diffDays}d`;
   if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem`;
   return `${Math.floor(diffDays / 30)}m`;
}

interface ThreadWelcomeProps {
   title: string;
   subtitle: string;
   iconUrl?: string;
   quickSuggestions?: QuickSuggestion[];
   recentThreadsSlot?: ReactNode;
   onSendSuggestion: (prompt: string) => void;
}

const ThreadWelcome: FC<ThreadWelcomeProps> = ({
   title,
   subtitle,
   iconUrl,
   quickSuggestions,
   recentThreadsSlot,
   onSendSuggestion,
}) => {
   return (
      <div className="aui-thread-welcome-root mx-auto flex w-full max-w-(--thread-max-width) grow flex-col">
         <div className="flex flex-1 flex-col items-center justify-center px-3 py-8">
            <div className="flex flex-col items-center gap-3 px-3 pb-6 text-center">
               <div className="relative flex items-center justify-center">
                  <div className="absolute size-24 rounded-full bg-primary/10 blur-xl" />
                  {iconUrl ? (
                     <div
                        className="size-20 bg-foreground"
                        style={{
                           maskImage: `url(${iconUrl})`,
                           maskSize: "contain",
                           maskRepeat: "no-repeat",
                           maskPosition: "center",
                        }}
                     />
                  ) : (
                     <SparklesIcon className="relative size-10 text-foreground" />
                  )}
               </div>
               <div className="flex flex-col items-center gap-1.5">
                  <h2 className="text-2xl font-semibold tracking-tight">
                     {title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
               </div>
            </div>

            {quickSuggestions && quickSuggestions.length > 0 && (
               <div className="flex flex-wrap justify-center gap-2">
                  {quickSuggestions.map((s) => (
                     <button
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                        key={s.label}
                        onClick={() => onSendSuggestion(s.prompt)}
                        type="button"
                     >
                        {s.label}
                     </button>
                  ))}
               </div>
            )}
         </div>

         {recentThreadsSlot && (
            <div className="w-full border-t border-border/60 px-3 pb-2 pt-3">
               <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Conversas recentes
               </p>
               <div className="flex flex-col">{recentThreadsSlot}</div>
            </div>
         )}
      </div>
   );
};

function UserMessage({ message }: { message: UIMessage }) {
   const textParts = message.parts.filter((p) => p.type === "text");
   return (
      <div
         className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-(--thread-max-width) animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 duration-150 [&:where(>*)]:col-start-2"
         data-role="user"
      >
         <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
            <div className="aui-user-message-content wrap-break-word rounded-2xl bg-accent px-4 py-2.5 text-accent-foreground">
               {textParts.map((part, idx) =>
                  part.type === "text" ? (
                     <p
                        className="whitespace-pre-wrap text-sm"
                        key={`${message.id}-${idx}`}
                     >
                        {part.content}
                     </p>
                  ) : null,
               )}
            </div>
         </div>
      </div>
   );
}

function AssistantMessageParts({ message }: { message: UIMessage }) {
   const toolResultMap = new Map<string, unknown>();
   for (const part of message.parts) {
      if (part.type === "tool-result") {
         toolResultMap.set(part.toolCallId, part.content);
      }
   }

   const renderedTools = new Set<string>();

   return (
      <>
         {message.parts.map((part, idx) => {
            if (part.type === "text") {
               return (
                  <MarkdownText
                     content={part.content}
                     key={`${message.id}-${idx}`}
                  />
               );
            }
            if (part.type === "thinking") {
               return (
                  <ReasoningDisplay
                     key={`${message.id}-${idx}`}
                     text={part.content}
                  />
               );
            }
            if (part.type === "tool-call") {
               if (renderedTools.has(part.id)) return null;
               renderedTools.add(part.id);

               const toolName = part.name;
               if (toolName === "skill-activate") return null;
               if (
                  toolName === "data-network" ||
                  toolName === "data-tool-network"
               ) {
                  return (
                     <DataNetworkRenderer
                        argsText={part.arguments}
                        key={`${message.id}-${idx}`}
                        result={toolResultMap.get(part.id)}
                        status={toToolStatus(part.state)}
                        toolName={toolName}
                     />
                  );
               }

               const ToolUI = TOOL_UI_REGISTRY[toolName];
               const toolProps: RubiToolProps = {
                  toolName,
                  argsText: part.arguments,
                  status: toToolStatus(part.state),
                  result: toolResultMap.get(part.id),
               };

               if (ToolUI) {
                  return <ToolUI key={`${message.id}-${idx}`} {...toolProps} />;
               }
               return (
                  <ToolFallback key={`${message.id}-${idx}`} {...toolProps} />
               );
            }
            return null;
         })}
      </>
   );
}

function ToolFallback({ toolName, status }: RubiToolProps) {
   const isRunning = status.type === "running";
   return (
      <div className="my-1 flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
         <span
            className={cn(
               "size-1.5 rounded-full",
               isRunning
                  ? "animate-pulse bg-primary"
                  : "bg-muted-foreground/40",
            )}
         />
         <span className="font-mono">{toolName}</span>
      </div>
   );
}

function AssistantMessage({ message }: { message: UIMessage }) {
   return (
      <div
         className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-3 duration-150"
         data-role="assistant"
      >
         <div className="aui-assistant-message-content wrap-break-word px-2 text-foreground leading-relaxed">
            <AssistantMessageParts message={message} />
         </div>
      </div>
   );
}

type ComposerProps = {
   chat: ReturnType<typeof useRubiChat>;
};

const Composer: FC<ComposerProps> = ({ chat }) => {
   const [input, setInput] = useState("");
   const [contextItems, setContextItems] = useState<ContextItem[]>([]);
   const contextId = useStore(chatContextStore, (s) => s.contextId);
   const selectedModel = useStore(chatContextStore, (s) => s.model);
   const prefillledForRef = useRef<string | null>(null);

   useEffect(() => {
      if (contextId && prefillledForRef.current !== contextId) {
         prefillledForRef.current = contextId;
         setContextItems([
            {
               type: "current-document",
               id: contextId,
               label: "Documento atual",
            },
         ]);
      } else if (!contextId) {
         prefillledForRef.current = null;
         setContextItems([]);
      }
   }, [contextId]);

   const handleContextSelect = (item: ContextItem) => {
      setContextItems((prev) =>
         prev.some((i) => i.id === item.id) ? prev : [...prev, item],
      );
   };

   const removeContextItem = (id: string) => {
      setContextItems((prev) => prev.filter((i) => i.id !== id));
   };

   const handleSubmit = () => {
      if (!input.trim() || chat.isLoading) return;
      chat.sendMessage(input.trim());
      setInput("");
      setContextItems([]);
   };

   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
         e.preventDefault();
         handleSubmit();
      }
   };

   return (
      <div className="aui-composer-root relative flex w-full flex-col">
         <div className="aui-composer-attachment-dropzone flex w-full flex-col rounded-xl border border-border/60 bg-background/80 shadow-sm outline-none backdrop-blur-sm transition-all has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:shadow-md has-[textarea:focus-visible]:ring-1 has-[textarea:focus-visible]:ring-ring/20">
            {contextItems.length > 0 && (
               <div className="flex flex-wrap gap-1 px-3 pt-2">
                  {contextItems.map((item) => (
                     <span
                        className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs"
                        key={item.id}
                     >
                        @{item.label}
                        <button
                           aria-label="Remover contexto"
                           className="ml-0.5 text-muted-foreground hover:text-foreground"
                           onClick={() => removeContextItem(item.id)}
                           type="button"
                        >
                           &times;
                        </button>
                     </span>
                  ))}
               </div>
            )}

            <TextareaAutosize
               aria-label="Campo de mensagem"
               autoFocus
               className="aui-composer-input max-h-32 min-h-12 w-full resize-none bg-transparent px-3 pb-1 pt-2 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={handleKeyDown}
               placeholder="Envie uma mensagem..."
               rows={1}
               value={input}
            />

            <div className="flex items-center justify-between px-2 pb-2">
               <div className="flex items-center gap-1">
                  <ModelSelector
                     models={MODEL_OPTIONS}
                     onValueChange={(v) => setChatModel(v as ModelId)}
                     triggerClassName="h-6 min-w-0 flex-1 border-none bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:bg-accent hover:text-foreground"
                     value={selectedModel}
                  />
                  <ContextPicker
                     currentDocumentId={contextId ?? undefined}
                     currentDocumentLabel="Documento atual"
                     onSelect={handleContextSelect}
                  />
               </div>
               <ComposerAction
                  isLoading={chat.isLoading}
                  onSend={handleSubmit}
                  onStop={chat.stop}
               />
            </div>
         </div>
      </div>
   );
};

const ComposerAction: FC<{
   isLoading: boolean;
   onSend: () => void;
   onStop: () => void;
}> = ({ isLoading, onSend, onStop }) => {
   if (isLoading) {
      return (
         <Button
            aria-label="Parar geração"
            className="aui-composer-cancel size-8 rounded-full"
            onClick={onStop}
            type="button"
            variant="default"
         >
            <SquareIcon className="size-3 fill-current" />
         </Button>
      );
   }
   return (
      <Button
         aria-label="Enviar mensagem"
         className="aui-composer-send size-8 rounded-full"
         onClick={onSend}
         type="button"
         variant="outline"
      >
         <ArrowUpIcon className="size-4" />
      </Button>
   );
};
