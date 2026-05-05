import type { UIMessage } from "@tanstack/ai-react";
import { Button } from "@packages/ui/components/button";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import { Brain, ChevronRight } from "lucide-react";
import { memo } from "react";
import { Streamdown } from "streamdown";
import { ToolCallCard } from "./tool-call-card";

interface MessageItemProps {
   message: UIMessage;
   isStreaming: boolean;
   onApprove: (approvalId: string) => Promise<void>;
   onReject: (approvalId: string) => Promise<void>;
}

function MessageItemImpl({
   message,
   isStreaming,
   onApprove,
   onReject,
}: MessageItemProps) {
   if (message.role === "system") return null;

   if (message.role === "user") {
      const text = message.parts
         .flatMap((part) => (part.type === "text" ? [part.content] : []))
         .join("");
      return (
         <div className="border-l-2 border-blue-500/60 px-4 py-2 text-sm">
            <span className="whitespace-pre-wrap font-medium">{text}</span>
         </div>
      );
   }

   return (
      <div className="text-sm">
         <div className="flex flex-col gap-2">
            {message.parts.map((part, idx) => {
               const key = `${part.type}-${idx}`;
               const isLast = idx === message.parts.length - 1;
               if (part.type === "text") {
                  return (
                     <div
                        className="border-l-2 border-muted-foreground/30 px-4 py-2"
                        key={key}
                     >
                        <Streamdown
                           isAnimating={isStreaming}
                           mode={isStreaming ? "streaming" : "static"}
                        >
                           {part.content}
                        </Streamdown>
                     </div>
                  );
               }
               if (part.type === "thinking") {
                  const isThinking = isStreaming && isLast;
                  return (
                     <Collapsible className="group/think text-sm" key={key}>
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-2 text-muted-foreground hover:text-foreground">
                           <span className="flex items-center gap-2">
                              <Brain className="size-4 shrink-0" />
                              {isThinking
                                 ? "Raciocinando"
                                 : "Raciocínio concluído"}
                           </span>
                           <ChevronRight className="size-4 shrink-0 transition-transform group-data-[state=open]/think:rotate-90" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="py-2 text-muted-foreground">
                           <Streamdown
                              isAnimating={isThinking}
                              mode={isThinking ? "streaming" : "static"}
                           >
                              {part.content}
                           </Streamdown>
                        </CollapsibleContent>
                     </Collapsible>
                  );
               }
               if (part.type === "tool-call") {
                  const needsDecision =
                     part.state === "approval-requested" &&
                     part.approval !== undefined &&
                     part.approval.approved === undefined;
                  return (
                     <div className="flex flex-col gap-2" key={key}>
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
                           <div className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-xs">
                              <span className="flex-1">
                                 Aprovar execução de{" "}
                                 <span className="font-mono">{part.name}</span>?
                              </span>
                              <Button
                                 className="h-7 px-2 text-xs"
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
                                 className="h-7 px-2 text-xs"
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
               }
               return null;
            })}
         </div>
      </div>
   );
}

export const MessageItem = memo(MessageItemImpl, (prev, next) => {
   if (prev.message.id !== next.message.id) return false;
   if (prev.isStreaming !== next.isStreaming) return false;
   if (prev.message.parts.length !== next.message.parts.length) return false;
   if (prev.message.parts.at(-1) !== next.message.parts.at(-1)) return false;
   if (prev.onApprove !== next.onApprove) return false;
   if (prev.onReject !== next.onReject) return false;
   return true;
});
