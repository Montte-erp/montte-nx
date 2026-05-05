import type { UIMessage } from "@tanstack/ai-react";
import { Button } from "@packages/ui/components/button";
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
         <div className="border-l-2 border-blue-500/60 px-3 py-2 text-sm">
            <span className="whitespace-pre-wrap font-medium">{text}</span>
         </div>
      );
   }

   return (
      <div className="border-l-2 border-muted-foreground/30 px-3 py-2 text-sm">
         <div className="flex flex-col gap-2">
            {message.parts.map((part, idx) => {
               const key = `${part.type}-${idx}`;
               if (part.type === "text") {
                  return (
                     <Streamdown
                        isAnimating={isStreaming}
                        key={key}
                        mode={isStreaming ? "streaming" : "static"}
                     >
                        {part.content}
                     </Streamdown>
                  );
               }
               if (part.type === "thinking") {
                  return (
                     <details
                        className="rounded-md border border-muted-foreground/20 bg-muted/30 px-2 py-1 text-xs"
                        key={key}
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
                           <div className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs">
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
