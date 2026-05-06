import type { ToolCallPart, UIMessage } from "@tanstack/ai";
import { Button } from "@packages/ui/components/button";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import { Brain, Check, ChevronDown, Loader2, Wrench } from "lucide-react";
import { memo } from "react";
import { Streamdown } from "streamdown";
import type { MessageMetadata } from "@core/database/schemas/messages";
import { MessageFooter } from "./message-footer";
import { TOOL_LABELS, presentToolIcon } from "./tool-meta";

interface MessageItemProps {
   message: UIMessage;
   metadata?: MessageMetadata | null;
   isStreaming: boolean;
   isLast: boolean;
   onApprove: (approvalId: string) => Promise<void>;
   onReject: (approvalId: string) => Promise<void>;
   onSendFollowUp?: (text: string) => Promise<void>;
}

function MessageItemImpl({
   message,
   metadata,
   isStreaming,
   isLast,
   onApprove,
   onReject,
   onSendFollowUp,
}: MessageItemProps) {
   if (message.role === "system") return null;

   if (message.role === "user") {
      const text = message.parts
         .flatMap((part) => (part.type === "text" ? [part.content] : []))
         .join("");
      return (
         <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-base">
               <span className="whitespace-pre-wrap">{text}</span>
            </div>
         </div>
      );
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
      isLast && !isStreaming && allToolsResolved && assistantText.length > 0;

   const followUps = isLast && !isStreaming ? metadata?.followUps : undefined;

   return (
      <div className="flex flex-col gap-3 text-base leading-relaxed">
         {renderParts(message.parts, {
            isStreaming,
            onApprove,
            onReject,
         })}
         {showFooter ? (
            <MessageFooter
               messageId={message.id}
               text={assistantText}
               traceId={metadata?.traceId}
            />
         ) : null}
         {followUps && followUps.length > 0 && onSendFollowUp ? (
            <FollowUpChips
               followUps={followUps}
               onSendFollowUp={onSendFollowUp}
            />
         ) : null}
      </div>
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
            <Streamdown
               isAnimating={ctx.isStreaming}
               key={key}
               mode={ctx.isStreaming ? "streaming" : "static"}
            >
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
                     isAnimating={isLive}
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

function FollowUpChips({
   followUps,
   onSendFollowUp,
}: {
   followUps: string[];
   onSendFollowUp: (text: string) => Promise<void>;
}) {
   return (
      <div className="flex flex-wrap gap-2">
         {followUps.map((text) => (
            <Button
               className="h-auto whitespace-normal rounded-full border-dashed px-3 py-1.5 text-left text-xs"
               key={text}
               onClick={() => void onSendFollowUp(text)}
               size="sm"
               type="button"
               variant="outline"
            >
               {text}
            </Button>
         ))}
      </div>
   );
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

export const MessageItem = memo(MessageItemImpl, (prev, next) => {
   if (prev.message.id !== next.message.id) return false;
   if (prev.isStreaming !== next.isStreaming) return false;
   if (prev.isLast !== next.isLast) return false;
   if (prev.message.parts.length !== next.message.parts.length) return false;
   if (prev.message.parts.at(-1) !== next.message.parts.at(-1)) return false;
   if (prev.metadata !== next.metadata) return false;
   if (prev.onApprove !== next.onApprove) return false;
   if (prev.onReject !== next.onReject) return false;
   if (prev.onSendFollowUp !== next.onSendFollowUp) return false;
   return true;
});
