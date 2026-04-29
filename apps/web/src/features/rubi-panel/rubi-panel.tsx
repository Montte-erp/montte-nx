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
import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "@tanstack/ai-react";
import dayjs from "dayjs";
import {
   ArrowRight,
   Briefcase,
   Check,
   ChevronDown,
   Contact,
   FolderTree,
   Gauge,
   Maximize2,
   Sparkles,
   Tag,
   Wallet,
} from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
import { RubiMascotIcon } from "./rubi-mascot-icon";
import { ToolCallCard } from "./tool-call-card";
import { useRubiChat } from "./use-rubi-chat";

interface Scope {
   id: string;
   label: string;
   icon: typeof Sparkles;
   skillHint?: string;
}

const SCOPES: Scope[] = [
   { id: "auto", label: "Auto", icon: Sparkles },
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

const SUGGESTION_IDS = [
   "servicos",
   "contatos",
   "financeiro",
   "categorias",
   "estoque",
   "analises",
];

export function RubiPanel() {
   const [value, setValue] = useState("");
   const [scopeOpen, setScopeOpen] = useState(false);
   const [selectedScope, setSelectedScope] = useState<Scope>(SCOPES[0]!);
   const { slug, teamSlug } = useDashboardSlugs();

   const chat = useRubiChat();
   const recentsQuery = useQuery(
      orpc.threads.list.queryOptions({ input: { limit: 5 } }),
   );

   const hasConversation = chat.messages.length > 0;
   const recents = recentsQuery.data?.threads ?? [];
   const showRecents = !chat.threadId && recents.length > 0;

   async function handleSend() {
      const text = value.trim();
      if (!text || chat.isStreaming) return;
      setValue("");
      await chat.sendMessage({
         text,
         skillHint: selectedScope.skillHint,
      });
   }

   function pickScopeById(id: string) {
      const next = SCOPES.find((s) => s.id === id);
      if (next) setSelectedScope(next);
   }

   return (
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle>Montte AI</ContextPanelTitle>
            <ContextPanelHeaderActions>
               {chat.threadId ? (
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
            {hasConversation ? (
               <ConversationView
                  messages={chat.messages}
                  pending={chat.isStreaming}
                  onApprove={chat.approveTool}
                  onReject={chat.rejectTool}
               />
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
                     value={value}
                     onChange={setValue}
                     onSend={handleSend}
                     scope={selectedScope}
                     scopes={SCOPES}
                     scopeOpen={scopeOpen}
                     onScopeOpenChange={setScopeOpen}
                     onScopeSelect={(s) => {
                        setSelectedScope(s);
                        setScopeOpen(false);
                     }}
                     disabled={chat.isStreaming}
                  />
                  <div className="flex flex-col items-center gap-2">
                     <p className="text-xs text-muted-foreground">
                        Tente o Montte AI para...
                     </p>
                     <div className="flex flex-wrap justify-center gap-2">
                        {SUGGESTION_IDS.map((id) => {
                           const scope = SCOPES.find((s) => s.id === id);
                           if (!scope) return null;
                           const Icon = scope.icon;
                           return (
                              <Button
                                 key={scope.id}
                                 type="button"
                                 variant="outline"
                                 size="sm"
                                 className="h-7 gap-2 rounded-full px-2 text-xs font-normal"
                                 onClick={() => pickScopeById(scope.id)}
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

            {hasConversation ? (
               <Composer
                  value={value}
                  onChange={setValue}
                  onSend={handleSend}
                  scope={selectedScope}
                  scopes={SCOPES}
                  scopeOpen={scopeOpen}
                  onScopeOpenChange={setScopeOpen}
                  onScopeSelect={(s) => {
                     setSelectedScope(s);
                     setScopeOpen(false);
                  }}
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
                  {recents.map((thread) => {
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
   onScopeSelect: (scope: Scope) => void;
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
                           onClick={() => props.onScopeSelect(scope)}
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
                  .filter(
                     (p): p is { type: "text"; content: string } =>
                        p.type === "text" &&
                        typeof (p as { content?: unknown }).content ===
                           "string",
                  )
                  .map((p) => p.content)
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
               const content = (part as { content?: string }).content ?? "";
               if (!content) return null;
               return (
                  <Streamdown
                     key={key}
                     mode={props.animating ? "streaming" : "static"}
                     isAnimating={props.animating}
                  >
                     {content}
                  </Streamdown>
               );
            }
            if (part.type === "thinking") {
               const content = (part as { content?: string }).content ?? "";
               if (!content) return null;
               return (
                  <details
                     key={key}
                     className="rounded-md border border-muted-foreground/20 bg-muted/30 px-2 py-1 text-xs"
                  >
                     <summary className="cursor-pointer text-muted-foreground">
                        Raciocínio
                     </summary>
                     <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
                        {content}
                     </div>
                  </details>
               );
            }
            if (part.type === "tool-call") {
               const tc = part as {
                  id: string;
                  name: string;
                  arguments?: string;
                  state?: string;
                  approval?: {
                     id: string;
                     needsApproval: boolean;
                     approved?: boolean;
                  };
                  output?: unknown;
               };
               const needsDecision =
                  tc.state === "approval-requested" &&
                  tc.approval &&
                  tc.approval.approved === undefined;
               return (
                  <div key={key} className="flex flex-col gap-2">
                     <ToolCallCard
                        toolCall={{
                           id: tc.id,
                           name: tc.name,
                           args: tc.arguments ?? "",
                           state:
                              tc.state === "input-streaming"
                                 ? "streaming"
                                 : tc.state === "approval-requested"
                                   ? "complete"
                                   : tc.output !== undefined
                                     ? "result"
                                     : "complete",
                           result:
                              tc.output === undefined
                                 ? undefined
                                 : typeof tc.output === "string"
                                   ? tc.output
                                   : JSON.stringify(tc.output, null, 2),
                        }}
                     />
                     {needsDecision ? (
                        <div className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs">
                           <span className="flex-1">
                              Aprovar execução de{" "}
                              <span className="font-mono">{tc.name}</span>?
                           </span>
                           <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => props.onReject(tc.approval!.id)}
                           >
                              Negar
                           </Button>
                           <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => props.onApprove(tc.approval!.id)}
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
