import {
   ActionBarMorePrimitive,
   ActionBarPrimitive,
   AuiIf,
   BranchPickerPrimitive,
   ComposerPrimitive,
   ErrorPrimitive,
   MessagePrimitive,
   ThreadPrimitive,
   useAui,
} from "@assistant-ui/react";
import type { ModelId } from "@core/agents/models";
import { AVAILABLE_MODELS } from "@core/agents/models";
import {
   ComposerAddAttachment,
   ComposerAttachments,
   UserMessageAttachments,
} from "@packages/ui/components/assistant-ui/attachment";
import { MarkdownText } from "@packages/ui/components/assistant-ui/markdown-text";
import {
   type ModelOption,
   ModelSelector,
} from "@packages/ui/components/assistant-ui/model-selector";
import { ToolFallback } from "@packages/ui/components/assistant-ui/tool-fallback";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import { useStore } from "@tanstack/react-store";
import {
   ArrowDownIcon,
   ArrowUpIcon,
   CheckIcon,
   ChevronLeftIcon,
   ChevronRightIcon,
   CopyIcon,
   DownloadIcon,
   MoreHorizontalIcon,
   PencilIcon,
   RefreshCwIcon,
   SparklesIcon,
   SquareIcon,
} from "lucide-react";
import type { FC, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
   chatContextStore,
   setChatModel,
} from "@/features/rubi-chat/stores/chat-context-store";
import { type ContextItem, ContextPicker } from "./context-picker";
import { AgentCallTool } from "./tool-components/agent-call-tool";
import { DataNetworkRenderer } from "./tool-components/data-network-renderer";
import { EditorTool } from "./tool-components/editor-tool";
import {
   ReasoningDisplay,
   ReasoningGroupDisplay,
} from "./tool-components/reasoning-display";
import { ResearchTool } from "./tool-components/research-tool";
import { SkillTool } from "./tool-components/skill-tool";
import { WorkflowCard } from "./tool-components/workflow-card";
import { WriteContentToolUI } from "./tool-components/write-content-tool";

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

export interface ThreadProps {
   welcomeTitle?: string;
   welcomeSubtitle?: string;
   welcomeIconUrl?: string;
   quickSuggestions?: QuickSuggestion[];
   recentThreadsSlot?: ReactNode;
}

export const Thread: FC<ThreadProps> = ({
   welcomeTitle = "O que você quer criar?",
   welcomeSubtitle = "Pesquise, escreva, audite SEO ou revise conteúdos.",
   welcomeIconUrl,
   quickSuggestions,
   recentThreadsSlot,
}) => {
   return (
      <ThreadPrimitive.Root
         className="aui-root aui-thread-root @container flex h-full w-full flex-col bg-transparent"
         style={{
            ["--thread-max-width" as string]: "44rem",
         }}
      >
         <WriteContentToolUI />
         <ThreadPrimitive.Viewport
            className="aui-thread-viewport relative flex flex-1 flex-col overflow-y-auto scroll-smooth "
            turnAnchor="top"
         >
            <AuiIf condition={(s) => s.thread.isEmpty}>
               <ThreadWelcome
                  iconUrl={welcomeIconUrl}
                  quickSuggestions={quickSuggestions}
                  recentThreadsSlot={recentThreadsSlot}
                  subtitle={welcomeSubtitle}
                  title={welcomeTitle}
               />
            </AuiIf>

            <ThreadPrimitive.Messages
               components={{
                  UserMessage,
                  EditComposer,
                  AssistantMessage,
               }}
            />

            <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 overflow-visible rounded-t-3xl bg-transparent pb-4 ">
               <AuiIf condition={(s) => !s.thread.isEmpty}>
                  <ThreadScrollToBottom />
               </AuiIf>
               <Composer />
            </ThreadPrimitive.ViewportFooter>
         </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
   );
};

const ThreadScrollToBottom: FC = () => {
   return (
      <ThreadPrimitive.ScrollToBottom asChild>
         <Button
            className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
            tooltip="Rolar para o final"
            variant="outline"
         >
            <ArrowDownIcon />
         </Button>
      </ThreadPrimitive.ScrollToBottom>
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
}

const ThreadWelcome: FC<ThreadWelcomeProps> = ({
   title,
   subtitle,
   iconUrl,
   quickSuggestions,
   recentThreadsSlot,
}) => {
   return (
      <div className="aui-thread-welcome-root mx-auto flex w-full max-w-(--thread-max-width) grow flex-col">
         {/* Centered main content */}
         <div className="flex flex-1 flex-col items-center justify-center px-3 py-8">
            {/* Icon + title + subtitle */}
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

            {/* Quick suggestion chips — flex wrap, centered */}
            {quickSuggestions && quickSuggestions.length > 0 && (
               <div className="flex flex-wrap justify-center gap-2">
                  {quickSuggestions.map((s) => (
                     <QuickChip
                        key={s.label}
                        label={s.label}
                        prompt={s.prompt}
                     />
                  ))}
               </div>
            )}
         </div>

         {/* Recent threads — pushed to bottom */}
         {recentThreadsSlot && (
            <div className="w-full border-t border-border/60 px-3 pt-3 pb-2">
               <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Conversas recentes
               </p>
               <div className="flex flex-col">{recentThreadsSlot}</div>
            </div>
         )}
      </div>
   );
};

const QuickChip: FC<{ label: string; prompt: string }> = ({
   label,
   prompt,
}) => {
   const api = useAui();
   return (
      <button
         className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
         onClick={() => {
            api.composer().setText(prompt);
         }}
         type="button"
      >
         {label}
      </button>
   );
};

type ComposerProps = {};

const Composer: FC<ComposerProps> = () => {
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
      setContextItems([]);
   };

   return (
      <ComposerPrimitive.Root
         className="aui-composer-root relative flex w-full flex-col"
         onSubmit={handleSubmit}
      >
         <ComposerPrimitive.AttachmentDropzone className="aui-composer-attachment-dropzone flex w-full flex-col rounded-xl border border-border/60 bg-background/80 shadow-sm outline-none backdrop-blur-sm transition-all has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:shadow-md has-[textarea:focus-visible]:ring-1 has-[textarea:focus-visible]:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50">
            {/* ── Settings bar: model + thinking budget ── */}

            {/* ── Attachments + context chips ── */}
            <ComposerAttachments />
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

            {/* ── Textarea ── */}
            <ComposerPrimitive.Input
               aria-label="Campo de mensagem"
               autoFocus
               className="aui-composer-input max-h-32 min-h-12 w-full resize-none bg-transparent px-3 pt-2 pb-1 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
               placeholder="Envie uma mensagem..."
               rows={1}
            />

            {/* ── Action bar: context | attachment + send ── */}
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
               <ComposerAction />
            </div>
         </ComposerPrimitive.AttachmentDropzone>
      </ComposerPrimitive.Root>
   );
};

const ComposerAction: FC = () => {
   return (
      <div className="aui-composer-action-wrapper relative  flex items-center justify-between gap-2">
         <ComposerAddAttachment />
         <AuiIf condition={(s) => !s.thread.isRunning}>
            <ComposerPrimitive.Send asChild>
               <Button
                  aria-label="Enviar mensagem"
                  className="aui-composer-send size-8 rounded-full"
                  type="submit"
                  variant="outline"
               >
                  <ArrowUpIcon className="aui-composer-send-icon size-4" />
               </Button>
            </ComposerPrimitive.Send>
         </AuiIf>
         <AuiIf condition={(s) => s.thread.isRunning}>
            <ComposerPrimitive.Cancel asChild>
               <Button
                  aria-label="Parar geração"
                  className="aui-composer-cancel size-8 rounded-full"
                  type="button"
                  variant="default"
               >
                  <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
               </Button>
            </ComposerPrimitive.Cancel>
         </AuiIf>
      </div>
   );
};

const MessageError: FC = () => {
   return (
      <MessagePrimitive.Error>
         <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
            <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
         </ErrorPrimitive.Root>
      </MessagePrimitive.Error>
   );
};

const AssistantMessage: FC = () => {
   return (
      <MessagePrimitive.Root
         className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-3 duration-150"
         data-role="assistant"
      >
         <div className="aui-assistant-message-content wrap-break-word px-2 text-foreground leading-relaxed">
            <MessagePrimitive.Parts
               components={{
                  Text: MarkdownText,
                  Reasoning: ReasoningDisplay,
                  ReasoningGroup: ReasoningGroupDisplay,
                  ToolGroup: WorkflowCard,
                  data: {
                     by_name: {
                        "data-network": DataNetworkRenderer,
                        "data-tool-network": DataNetworkRenderer,
                     },
                     Fallback: ({ name }) => {
                        console.log("[data-renderer] unmapped:", name);
                        return null;
                     },
                  },
                  tools: {
                     Fallback: ToolFallback,
                     by_name: {
                        // Agent sub-calls
                        "agent-research-agent": AgentCallTool,
                        "agent-writer-agent": AgentCallTool,
                        "agent-seo-auditor-agent": AgentCallTool,
                        "agent-reviewer-agent": AgentCallTool,
                        "agent-content-agent": AgentCallTool,
                        // Editor tools
                        "write-content": EditorTool,
                        analyzeContent: ResearchTool,
                        replaceText: EditorTool,
                        insertHeading: EditorTool,
                        insertList: EditorTool,
                        insertCodeBlock: EditorTool,
                        insertTable: EditorTool,
                        // Frontmatter tools
                        editTitle: EditorTool,
                        editDescription: EditorTool,
                        editKeywords: EditorTool,
                        editSlug: EditorTool,
                        // Research tools
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
                        // Analysis tools (SEO auditor + reviewer)
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
                        // SEO editor tools
                        optimizeTitle: EditorTool,
                        optimizeMeta: EditorTool,
                        injectKeywords: EditorTool,
                        addInternalLinks: EditorTool,
                        addExternalLinks: EditorTool,
                        improveReadability: EditorTool,
                        generateQuickAnswer: EditorTool,
                        // Platform CRUD tools
                        createContent: EditorTool,
                        updateContent: EditorTool,
                        deleteContent: EditorTool,
                        createDashboard: EditorTool,
                        createForm: EditorTool,
                        // Memory & utility
                        getInstructionMemories: ResearchTool,
                        dateTool: ResearchTool,
                        // Workspace skill tools
                        mastra_workspace_read_file: SkillTool,
                        mastra_workspace_search: SkillTool,
                        mastra_workspace_list_files: SkillTool,
                        // Internal agent implementation details — hidden from UI
                        "skill-activate": () => null,
                     },
                  },
               }}
            />
            <MessageError />
         </div>

         <div className="aui-assistant-message-footer mt-1 ml-2 flex">
            <BranchPicker />
            <AssistantActionBar />
         </div>
      </MessagePrimitive.Root>
   );
};

const AssistantActionBar: FC = () => {
   return (
      <ActionBarPrimitive.Root
         autohide="not-last"
         autohideFloat="single-branch"
         className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
         hideWhenRunning
      >
         <ActionBarPrimitive.Copy asChild>
            <Button
               className="aui-button-icon size-6 p-1"
               tooltip="Copiar"
               variant="outline"
            >
               <AuiIf condition={(s) => s.message.isCopied}>
                  <CheckIcon />
               </AuiIf>
               <AuiIf condition={(s) => !s.message.isCopied}>
                  <CopyIcon />
               </AuiIf>
            </Button>
         </ActionBarPrimitive.Copy>
         <ActionBarPrimitive.Reload asChild>
            <Button
               className="aui-button-icon size-6 p-1"
               tooltip="Gerar novamente"
               variant="outline"
            >
               <RefreshCwIcon />
            </Button>
         </ActionBarPrimitive.Reload>
         <ActionBarMorePrimitive.Root>
            <ActionBarMorePrimitive.Trigger asChild>
               <Button
                  className="aui-button-icon size-6 p-1 data-[state=open]:bg-accent"
                  tooltip="Mais"
                  variant="outline"
               >
                  <MoreHorizontalIcon />
               </Button>
            </ActionBarMorePrimitive.Trigger>
            <ActionBarMorePrimitive.Content
               align="start"
               className="aui-action-bar-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
               side="bottom"
            >
               <ActionBarPrimitive.ExportMarkdown asChild>
                  <ActionBarMorePrimitive.Item className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                     <DownloadIcon className="size-4" />
                     Exportar como Markdown
                  </ActionBarMorePrimitive.Item>
               </ActionBarPrimitive.ExportMarkdown>
            </ActionBarMorePrimitive.Content>
         </ActionBarMorePrimitive.Root>
      </ActionBarPrimitive.Root>
   );
};

const UserMessage: FC = () => {
   return (
      <MessagePrimitive.Root
         className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-(--thread-max-width) animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 duration-150 [&:where(>*)]:col-start-2"
         data-role="user"
      >
         <UserMessageAttachments />

         <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
            <div className="aui-user-message-content wrap-break-word rounded-2xl bg-accent px-4 py-2.5 text-accent-foreground">
               <MessagePrimitive.Parts />
            </div>
            <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
               <UserActionBar />
            </div>
         </div>

         <BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-self-end" />
      </MessagePrimitive.Root>
   );
};

const UserActionBar: FC = () => {
   return (
      <ActionBarPrimitive.Root
         autohide="not-last"
         className="aui-user-action-bar-root flex flex-col items-end"
         hideWhenRunning
      >
         <ActionBarPrimitive.Edit asChild>
            <Button
               className="aui-user-action-edit size-6 p-4"
               tooltip="Editar"
               variant="outline"
            >
               <PencilIcon />
            </Button>
         </ActionBarPrimitive.Edit>
      </ActionBarPrimitive.Root>
   );
};

const EditComposer: FC = () => {
   return (
      <MessagePrimitive.Root className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-3">
         <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-accent">
            <ComposerPrimitive.Input
               autoFocus
               className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none"
            />
            <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
               <ComposerPrimitive.Cancel asChild>
                  <Button variant="ghost">Cancelar</Button>
               </ComposerPrimitive.Cancel>
               <ComposerPrimitive.Send asChild>
                  <Button>Atualizar</Button>
               </ComposerPrimitive.Send>
            </div>
         </ComposerPrimitive.Root>
      </MessagePrimitive.Root>
   );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
   className,
   ...rest
}) => {
   return (
      <BranchPickerPrimitive.Root
         className={cn(
            "aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-muted-foreground text-xs",
            className,
         )}
         hideWhenSingleBranch
         {...rest}
      >
         <BranchPickerPrimitive.Previous asChild>
            <Button
               className="aui-button-icon size-6 p-1"
               tooltip="Anterior"
               variant="outline"
            >
               <ChevronLeftIcon />
            </Button>
         </BranchPickerPrimitive.Previous>
         <span className="aui-branch-picker-state font-medium">
            <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
         </span>
         <BranchPickerPrimitive.Next asChild>
            <Button
               className="aui-button-icon size-6 p-1"
               tooltip="Próximo"
               variant="outline"
            >
               <ChevronRightIcon />
            </Button>
         </BranchPickerPrimitive.Next>
      </BranchPickerPrimitive.Root>
   );
};
