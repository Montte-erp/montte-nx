import { Button } from "@packages/ui/components/button";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelFooter,
   ContextPanelHeader,
   ContextPanelHeaderActions,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Textarea } from "@packages/ui/components/textarea";
import { Link } from "@tanstack/react-router";
import type { UIMessage } from "@tanstack/ai-react";
import dayjs from "dayjs";
import { ArrowRight, Check, ChevronDown, Maximize2 } from "lucide-react";
import { Streamdown } from "streamdown";
import { QueryBoundary } from "@/components/query-boundary";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useRubiChat, type RubiScopeId } from "./rubi-chat-store";
import { RubiMascotIcon } from "./rubi-mascot-icon";
import { ToolCallCard } from "./tool-call-card";

interface Scope {
   id: RubiScopeId;
   label: string;
   icon: React.ComponentType<{ className?: string }>;
   skillHint?: string;
}

export function RubiPanel() {
   return (
      <QueryBoundary fallback={null} errorTitle="Falha ao carregar Rubi">
         <RubiPanelContent />
      </QueryBoundary>
   );
}

function RubiPanelContent() {
   const { slug, teamSlug } = useDashboardSlugs();
   const chat = useRubiChat();

   const showRecents = !chat.activeThreadId && chat.recents.length > 0;

   async function handleSend() {
      const text = chat.composerValue.trim();
      if (!text || chat.isStreaming) return;
      await chat.sendMessage();
   }

   return (
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle>Montte AI</ContextPanelTitle>
            <ContextPanelHeaderActions>
               {chat.activeThreadId ? (
                  <Button
                     aria-label="Nova conversa"
                     size="sm"
                     variant="ghost"
                     className="h-7 px-2 text-xs"
                     onClick={() => chat.reset()}
                  >
                     Nova
                  </Button>
               ) : null}
               <Button
                  aria-label="Abrir em tela cheia"
                  asChild
                  size="icon"
                  variant="ghost"
                  className="size-7"
               >
                  <Link
                     params={{ slug, teamSlug }}
                     search={(prev) => prev}
                     to="/$slug/$teamSlug/chat"
                  >
                     <Maximize2 className="size-4" />
                  </Link>
               </Button>
            </ContextPanelHeaderActions>
         </ContextPanelHeader>

         <ContextPanelContent className="flex flex-col gap-4">
            {chat.hasConversation ? (
               <>
                  {chat.pendingApprovalIds.length >= 2 ? (
                     <div className="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs">
                        <span className="flex-1">
                           {chat.pendingApprovalIds.length} ações aguardando
                           aprovação
                        </span>
                        <Button
                           size="sm"
                           variant="outline"
                           className="h-7 px-2 text-xs"
                           onClick={() => chat.rejectAll()}
                        >
                           Negar tudo
                        </Button>
                        <Button
                           size="sm"
                           className="h-7 px-2 text-xs"
                           onClick={() => chat.approveAll()}
                        >
                           Aprovar tudo ({chat.pendingApprovalIds.length})
                        </Button>
                     </div>
                  ) : null}
                  <ConversationView
                     messages={chat.messages}
                     pending={chat.isStreaming}
                     onApprove={chat.approveTool}
                     onReject={chat.rejectTool}
                  />
               </>
            ) : (
               <div className="flex flex-1 flex-col items-center justify-center gap-4">
                  <RubiMascotIcon className="size-12" />
                  <div className="flex flex-col items-center gap-2 text-center">
                     <h1 className="text-lg font-semibold">
                        Como posso te ajudar?
                     </h1>
                     <p className="text-xs italic text-muted-foreground">
                        Gerencie seu negócio com inteligência.
                     </p>
                  </div>
                  <Composer
                     value={chat.composerValue}
                     onChange={chat.setComposerValue}
                     onSend={handleSend}
                     scope={chat.selectedScope}
                     scopes={chat.scopes}
                     scopeOpen={chat.scopeOpen}
                     onScopeOpenChange={chat.setScopeOpen}
                     onScopeSelect={chat.selectScope}
                     disabled={chat.isStreaming}
                  />
                  <div className="flex flex-col items-center gap-2">
                     <p className="text-xs text-muted-foreground">
                        Tente o Montte AI para...
                     </p>
                     <div className="flex flex-wrap justify-center gap-2">
                        {chat.suggestions.map((scope) => {
                           const Icon = scope.icon;
                           return (
                              <Button
                                 key={scope.id}
                                 type="button"
                                 variant="outline"
                                 size="sm"
                                 className="h-7 gap-2 rounded-full px-2 text-xs font-normal"
                                 onClick={() => chat.selectScope(scope.id)}
                              >
                                 <Icon className="size-4" />
                                 {scope.label}
                              </Button>
                           );
                        })}
                     </div>
                  </div>
               </div>
            )}

            {chat.hasConversation ? (
               <Composer
                  value={chat.composerValue}
                  onChange={chat.setComposerValue}
                  onSend={handleSend}
                  scope={chat.selectedScope}
                  scopes={chat.scopes}
                  scopeOpen={chat.scopeOpen}
                  onScopeOpenChange={chat.setScopeOpen}
                  onScopeSelect={chat.selectScope}
                  disabled={chat.isStreaming}
               />
            ) : null}
         </ContextPanelContent>

         {showRecents ? (
            <ContextPanelFooter>
               <div className="flex items-center justify-between pb-2">
                  <span className="text-xs text-muted-foreground">
                     Conversas recentes
                  </span>
               </div>
               <ul className="flex flex-col gap-2">
                  {chat.recents.map((thread) => {
                     const days = thread.lastMessageAt
                        ? dayjs().diff(dayjs(thread.lastMessageAt), "day")
                        : dayjs().diff(dayjs(thread.createdAt), "day");
                     return (
                        <li
                           key={thread.id}
                           className="flex items-center justify-between gap-2 text-xs"
                        >
                           <button
                              type="button"
                              className="flex-1 truncate text-left text-foreground hover:underline"
                              onClick={() => chat.loadThread(thread.id)}
                           >
                              {thread.title ?? "Conversa sem título"}
                           </button>
                           <span className="shrink-0 text-muted-foreground">
                              {days}d
                           </span>
                        </li>
                     );
                  })}
               </ul>
            </ContextPanelFooter>
         ) : null}
      </ContextPanel>
   );
}

interface ComposerProps {
   value: string;
   onChange: (v: string) => void;
   onSend: () => void;
   scope: Scope;
   scopes: Scope[];
   scopeOpen: boolean;
   onScopeOpenChange: (open: boolean) => void;
   onScopeSelect: (scope: RubiScopeId) => void;
   disabled?: boolean;
}

function Composer(props: ComposerProps) {
   return (
      <div className="w-full rounded-xl border bg-background">
         <Textarea
            aria-label="Mensagem para o Montte AI"
            className="min-h-[80px] resize-none border-0 bg-transparent px-4 py-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Faça uma pergunta ou / para comandos"
            value={props.value}
            disabled={props.disabled}
            onChange={(e) => props.onChange(e.target.value)}
            onKeyDown={(e) => {
               if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  props.onSend();
               }
            }}
         />
         <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-2">
               <Popover
                  open={props.scopeOpen}
                  onOpenChange={props.onScopeOpenChange}
               >
                  <PopoverTrigger asChild>
                     <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-2 rounded-full px-2 text-xs font-normal text-muted-foreground"
                     >
                        <props.scope.icon className="size-4" />
                        {props.scope.label}
                        <ChevronDown className="size-4" />
                     </Button>
                  </PopoverTrigger>
                  <PopoverContent
                     align="start"
                     className="w-44 p-2"
                     sideOffset={4}
                  >
                     {props.scopes.map((scope) => (
                        <Button
                           key={scope.id}
                           variant="ghost"
                           className="flex w-full items-center justify-start gap-2 rounded-sm px-2 py-2 text-xs"
                           onClick={() => props.onScopeSelect(scope.id)}
                        >
                           <scope.icon className="size-4 text-muted-foreground" />
                           <span>{scope.label}</span>
                           {props.scope.id === scope.id ? (
                              <Check className="size-4 text-primary" />
                           ) : null}
                        </Button>
                     ))}
                  </PopoverContent>
               </Popover>
            </div>
            <Button
               aria-label="Enviar"
               className="size-8 rounded-md"
               disabled={!props.value.trim() || props.disabled}
               size="icon"
               onClick={props.onSend}
            >
               <ArrowRight />
            </Button>
         </div>
      </div>
   );
}

function MessageRow(props: {
   role: "user" | "assistant";
   children: React.ReactNode;
}) {
   const accent =
      props.role === "user"
         ? "border-blue-500/60"
         : "border-muted-foreground/30";
   return (
      <div className={`border-l-2 ${accent} px-3 py-2 text-sm`}>
         {props.children}
      </div>
   );
}

function ConversationView(props: {
   messages: UIMessage[];
   pending: boolean;
   onApprove: (approvalId: string) => Promise<void>;
   onReject: (approvalId: string) => Promise<void>;
}) {
   const lastIndex = props.messages.length - 1;
   return (
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
         {props.messages.map((msg, idx) => {
            if (msg.role === "system") return null;
            if (msg.role === "user") {
               const text = msg.parts
                  .flatMap((part) => {
                     if (part.type !== "text") return [];
                     return [part.content];
                  })
                  .join("");
               return (
                  <MessageRow key={msg.id} role="user">
                     <span className="whitespace-pre-wrap font-medium">
                        {text}
                     </span>
                  </MessageRow>
               );
            }
            const isLastAssistant = idx === lastIndex && props.pending;
            return (
               <MessageRow key={msg.id} role="assistant">
                  <AssistantParts
                     parts={msg.parts}
                     animating={isLastAssistant}
                     onApprove={props.onApprove}
                     onReject={props.onReject}
                  />
               </MessageRow>
            );
         })}
         {props.pending &&
         lastIndex >= 0 &&
         props.messages[lastIndex]?.role === "user" ? (
            <div className="border-l-2 border-muted-foreground/30 px-3 py-2 text-sm shimmer">
               Rubi está pensando…
            </div>
         ) : null}
      </div>
   );
}

function AssistantParts(props: {
   parts: UIMessage["parts"];
   animating: boolean;
   onApprove: (id: string) => Promise<void>;
   onReject: (id: string) => Promise<void>;
}) {
   return (
      <div className="flex flex-col gap-2">
         {props.parts.map((part, idx) => {
            const key = `${part.type}-${idx}`;
            if (part.type === "text") {
               return (
                  <Streamdown
                     key={key}
                     mode={props.animating ? "streaming" : "static"}
                     isAnimating={props.animating}
                  >
                     {part.content}
                  </Streamdown>
               );
            }
            if (part.type === "thinking") {
               return (
                  <details
                     key={key}
                     className="rounded-md border border-muted-foreground/20 bg-muted/30 px-2 py-1 text-xs"
                  >
                     <summary className="cursor-pointer text-muted-foreground">
                        Raciocínio
                     </summary>
                     <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
                        {part.content}
                     </div>
                  </details>
               );
            }
            if (part.type === "tool-call") {
               const needsDecision =
                  part.state === "approval-requested" &&
                  part.approval !== undefined &&
                  part.approval.approved === undefined;
               return (
                  <div key={key} className="flex flex-col gap-2">
                     <ToolCallCard
                        toolCall={{
                           id: part.id,
                           name: part.name,
                           args: part.arguments ?? "",
                           state:
                              part.state === "input-streaming"
                                 ? "streaming"
                                 : part.state === "approval-requested"
                                   ? "complete"
                                   : part.output !== undefined
                                     ? "result"
                                     : "complete",
                           result:
                              part.output === undefined
                                 ? undefined
                                 : typeof part.output === "string"
                                   ? part.output
                                   : JSON.stringify(part.output, null, 2),
                        }}
                     />
                     {needsDecision ? (
                        <div className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs">
                           <span className="flex-1">
                              Aprovar execução de{" "}
                              <span className="font-mono">{part.name}</span>?
                           </span>
                           <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                 if (part.approval === undefined) return;
                                 void props.onReject(part.approval.id);
                              }}
                           >
                              Negar
                           </Button>
                           <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                 if (part.approval === undefined) return;
                                 void props.onApprove(part.approval.id);
                              }}
                           >
                              Aprovar
                           </Button>
                        </div>
                     ) : null}
                  </div>
               );
            }
            return null;
         })}
      </div>
   );
}
