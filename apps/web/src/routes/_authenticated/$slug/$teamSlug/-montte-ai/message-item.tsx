import type { ToolCallPart, UIMessage } from "@tanstack/ai";
import { Button } from "@packages/ui/components/button";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import { Textarea } from "@packages/ui/components/textarea";
import {
   Brain,
   Check,
   ChevronDown,
   Loader2,
   Pencil,
   RefreshCw,
   Trash2,
   Wrench,
   X,
   Compass,
   Lightbulb,
   Search,
   Sparkles,
   type LucideIcon,
} from "lucide-react";
import { memo, useState } from "react";
import { Streamdown } from "streamdown";
import { useChatSession } from "./chat-store";
import type { ChatMessage } from "./chat-data";
import { MessageFooter } from "./message-footer";

type ChatMessageMetadata = ChatMessage["metadata"];

const TOOL_LABELS: Record<string, string> = {
   advisor_consult: "Consultando advisor sênior",
   web_search: "Pesquisando na web",
   skill_discover: "Carregando playbook",
   __lazy__tool__discovery__: "Carregando ferramentas",
   services_list: "Listando serviços",
   services_get: "Detalhando serviço",
   services_create: "Criando serviço",
   services_update: "Atualizando serviço",
   services_set_active: "Ativando ou arquivando serviços",
   services_bulk_create: "Criando serviços em lote",
   services_attach_benefit: "Vinculando benefício ao serviço",
   services_setup: "Configurando serviço completo",
   services_create_price: "Criando preço",
   prices_update: "Atualizando preço",
   prices_delete: "Removendo preço",
   meters_list: "Listando medidores",
   meters_create: "Criando medidor",
   meters_update: "Atualizando medidor",
   benefits_list: "Listando benefícios",
   benefits_create: "Criando benefício",
   coupons_list: "Listando cupons",
   coupons_create: "Criando cupom",
};

function presentToolIcon(name: string | undefined): LucideIcon {
   if (name === "advisor_consult") return Lightbulb;
   if (name === "skill_discover") return Sparkles;
   if (name === "__lazy__tool__discovery__") return Compass;
   if (name === "web_search") return Search;
   return Wrench;
}

interface MessageItemProps {
   message: UIMessage;
   metadata?: ChatMessageMetadata;
   isStreaming: boolean;
   isLast: boolean;
   onApprove: (approvalId: string) => Promise<void>;
   onReject: (approvalId: string) => Promise<void>;
}

function MessageItemImpl({
   message,
   metadata,
   isStreaming,
   isLast,
   onApprove,
   onReject,
}: MessageItemProps) {
   if (message.role === "system") return null;

   if (message.role === "user") {
      return <UserBubble message={message} />;
   }

   const assistantText = message.parts
      .flatMap((part) => (part.type === "text" ? [part.content] : []))
      .join("\n\n");
   const allToolsResolved = message.parts.every(
      (part) =>
         part.type !== "tool-call" ||
         part.output !== undefined ||
         part.state === "approval-requested",
   );
   const showFooter =
      !isStreaming && allToolsResolved && assistantText.length > 0;

   return (
      <div className="group/msg flex flex-col gap-3 text-base leading-relaxed">
         {renderParts(message.parts, {
            isStreaming,
            onApprove,
            onReject,
         })}
         {showFooter ? (
            <div className="flex items-center justify-between gap-2">
               <MessageFooter
                  messageId={message.id}
                  text={assistantText}
                  traceId={metadata?.traceId}
               />
               {isLast ? null : (
                  <DeleteButton
                     messageId={message.id}
                     label="Excluir resposta"
                  />
               )}
            </div>
         ) : null}
      </div>
   );
}

function UserBubble({ message }: { message: UIMessage }) {
   const { editAndResend, regenerateFrom, isStreaming } = useChatSession();
   const [editing, setEditing] = useState(false);
   const text = message.parts
      .flatMap((part) => (part.type === "text" ? [part.content] : []))
      .join("");
   const [draft, setDraft] = useState(text);

   if (editing) {
      return (
         <div className="flex flex-col items-end gap-2">
            <Textarea
               aria-label="Editar mensagem"
               className="max-w-[85%] resize-none rounded-2xl text-base"
               onChange={(e) => setDraft(e.target.value)}
               value={draft}
            />
            <div className="flex items-center gap-2">
               <Button
                  onClick={() => {
                     setEditing(false);
                     setDraft(text);
                  }}
                  size="sm"
                  variant="ghost"
               >
                  <X className="size-4" />
                  Cancelar
               </Button>
               <Button
                  disabled={!draft.trim() || draft.trim() === text}
                  onClick={() => {
                     setEditing(false);
                     void editAndResend(message.id, draft);
                  }}
                  size="sm"
               >
                  Enviar
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="group/user flex flex-col items-end gap-1">
         <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-base">
            <span className="whitespace-pre-wrap">{text}</span>
         </div>
         {!isStreaming ? (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/user:opacity-100">
               <Button
                  aria-label="Editar"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                     setDraft(text);
                     setEditing(true);
                  }}
                  size="icon"
                  variant="ghost"
               >
                  <Pencil className="size-3.5" />
               </Button>
               <Button
                  aria-label="Regenerar resposta"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => void regenerateFrom(message.id)}
                  size="icon"
                  variant="ghost"
               >
                  <RefreshCw className="size-3.5" />
               </Button>
               <DeleteButton messageId={message.id} label="Excluir mensagem" />
            </div>
         ) : null}
      </div>
   );
}

function DeleteButton({
   messageId,
   label,
}: {
   messageId: string;
   label: string;
}) {
   const { deleteMessage, isStreaming } = useChatSession();
   return (
      <Button
         aria-label={label}
         className="size-7 text-muted-foreground hover:text-destructive"
         disabled={isStreaming}
         onClick={() => void deleteMessage(messageId)}
         size="icon"
         variant="ghost"
      >
         <Trash2 className="size-3.5" />
      </Button>
   );
}

interface RenderContext {
   isStreaming: boolean;
   onApprove: (approvalId: string) => Promise<void>;
   onReject: (approvalId: string) => Promise<void>;
}

function renderParts(parts: UIMessage["parts"], ctx: RenderContext) {
   const out: React.ReactNode[] = [];
   let toolBuffer: ToolCallPart[] = [];

   const flushTools = (key: string) => {
      if (toolBuffer.length === 0) return;
      out.push(
         <ToolGroup
            isStreaming={ctx.isStreaming}
            key={`tools-${key}`}
            onApprove={ctx.onApprove}
            onReject={ctx.onReject}
            parts={toolBuffer}
         />,
      );
      toolBuffer = [];
   };

   parts.forEach((part, idx) => {
      const key = `${part.type}-${idx}`;
      if (part.type === "tool-call") {
         toolBuffer.push(part);
         return;
      }
      flushTools(`${idx}-pre`);
      if (part.type === "text") {
         out.push(
            <Streamdown isAnimating key={key} animated>
               {part.content}
            </Streamdown>,
         );
         return;
      }
      if (part.type === "thinking") {
         const isLive = ctx.isStreaming && idx === parts.length - 1;
         out.push(
            <Collapsible className="group/think" defaultOpen={isLive} key={key}>
               <CollapsibleTrigger className="flex w-full items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground">
                  <Brain className="size-4 shrink-0" />
                  <span className="flex-1 text-left">
                     {isLive ? "Raciocinando" : "Raciocínio concluído"}
                  </span>
                  <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]/think:rotate-180" />
               </CollapsibleTrigger>
               <CollapsibleContent className="ml-[22px] border-l border-muted-foreground/15 py-1 pl-3 text-sm text-muted-foreground">
                  <Streamdown
                     caret="circle"
                     mode={isLive ? "streaming" : "static"}
                  >
                     {part.content}
                  </Streamdown>
               </CollapsibleContent>
            </Collapsible>,
         );
      }
   });
   flushTools("end");
   return out;
}

function ToolGroup({
   parts,
   onApprove,
   onReject,
}: {
   parts: ToolCallPart[];
   isStreaming: boolean;
   onApprove: (approvalId: string) => Promise<void>;
   onReject: (approvalId: string) => Promise<void>;
}) {
   const total = parts.length;
   const anyRunning = parts.some(
      (p) =>
         p.state === "input-streaming" ||
         (p.output === undefined && p.state !== "approval-requested"),
   );
   const needsDecision = parts.find(
      (p) =>
         p.state === "approval-requested" &&
         p.approval !== undefined &&
         p.approval.approved === undefined,
   );
   const headerLabel = anyRunning
      ? `Executando ${total} ${total === 1 ? "ferramenta" : "ferramentas"}`
      : `${total} ${total === 1 ? "ferramenta executada" : "ferramentas executadas"}`;

   return (
      <Collapsible
         className="group/tools rounded-lg border border-muted-foreground/15 bg-muted/30"
         defaultOpen={anyRunning || needsDecision !== undefined}
      >
         <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            {anyRunning ? (
               <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : (
               <Wrench className="size-4 shrink-0" />
            )}
            <span className="flex-1 text-left">{headerLabel}</span>
            {!anyRunning ? (
               <Check className="size-3.5 shrink-0 text-emerald-500" />
            ) : null}
            <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]/tools:rotate-180" />
         </CollapsibleTrigger>
         <CollapsibleContent className="flex flex-col gap-1.5 border-t border-muted-foreground/10 px-3 py-2">
            {parts.map((part) => {
               const isRunning =
                  part.state === "input-streaming" ||
                  (part.output === undefined &&
                     part.state !== "approval-requested");
               if (part.name === "web_search")
                  return (
                     <WebSearchToolCard
                        isRunning={isRunning}
                        key={part.id}
                        part={part}
                     />
                  );
               const partNeedsDecision =
                  part.state === "approval-requested" &&
                  part.approval !== undefined &&
                  part.approval.approved === undefined;
               const Icon = presentToolIcon(part.name);
               const label = TOOL_LABELS[part.name] ?? "Executando ferramenta";
               return (
                  <div className="flex flex-col gap-2" key={part.id}>
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {isRunning ? (
                           <Loader2 className="size-4 shrink-0 animate-spin" />
                        ) : (
                           <Icon className="size-4 shrink-0" />
                        )}
                        <span>{label}</span>
                        {!isRunning && !partNeedsDecision ? (
                           <Check className="size-3.5 shrink-0 text-emerald-500" />
                        ) : null}
                     </div>
                     {partNeedsDecision ? (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-2.5 text-sm">
                           <span className="flex-1">
                              Aprovar{" "}
                              <span className="font-medium">{label}</span>?
                           </span>
                           <Button
                              className="h-8 px-3 text-sm"
                              onClick={() => {
                                 if (part.approval === undefined) return;
                                 void onReject(part.approval.id);
                              }}
                              size="sm"
                              variant="outline"
                           >
                              Negar
                           </Button>
                           <Button
                              className="h-8 px-3 text-sm"
                              onClick={() => {
                                 if (part.approval === undefined) return;
                                 void onApprove(part.approval.id);
                              }}
                              size="sm"
                           >
                              Aprovar
                           </Button>
                        </div>
                     ) : null}
                  </div>
               );
            })}
         </CollapsibleContent>
      </Collapsible>
   );
}

function WebSearchToolCard({
   part,
   isRunning,
}: {
   part: ToolCallPart;
   isRunning: boolean;
}) {
   const status = isRunning ? "Pesquisando" : "Pesquisa concluída";

   return (
      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
         <div className="flex items-center gap-2 text-sm">
            {isRunning ? (
               <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
               <Search className="size-4 shrink-0 text-primary" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
               <span className="font-medium text-foreground">
                  OpenRouter Web Search
               </span>
               <span className="text-muted-foreground">{status}</span>
            </div>
            {!isRunning ? (
               <Check className="size-4 shrink-0 text-emerald-500" />
            ) : null}
         </div>
         {part.arguments ? (
            <pre className="overflow-x-auto pt-2 text-xs text-muted-foreground">
               {part.arguments}
            </pre>
         ) : null}
      </div>
   );
}

export const MessageItem = memo(MessageItemImpl, (prev, next) => {
   if (prev.message.id !== next.message.id) return false;
   if (prev.isStreaming !== next.isStreaming) return false;
   if (prev.isLast !== next.isLast) return false;
   if (prev.message.parts.length !== next.message.parts.length) return false;
   if (prev.message.parts.at(-1) !== next.message.parts.at(-1)) return false;
   if (prev.metadata !== next.metadata) return false;
   if (prev.onApprove !== next.onApprove) return false;
   if (prev.onReject !== next.onReject) return false;
   return true;
});
