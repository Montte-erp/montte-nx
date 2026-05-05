import { Button } from "@packages/ui/components/button";
import { ArrowDown } from "lucide-react";
import { useChatSession } from "./chat-store";
import { MessageItem } from "./message-item";
import { useStickToBottom } from "./use-stick-to-bottom";

interface MessageListProps {
   session: ReturnType<typeof useChatSession>;
}

export function MessageList({ session }: MessageListProps) {
   const { scrollerRef, onScroll, scrollToBottom, isAtBottom } =
      useStickToBottom();

   const { messages, isStreaming, isSubmitting, approveTool, rejectTool } =
      session;
   const lastIndex = messages.length - 1;
   const last = messages.at(-1);
   const showThinking = isSubmitting || (isStreaming && last?.role === "user");

   return (
      <div className="relative flex flex-1 min-h-0 flex-col">
         <div
            className="flex-1 overflow-y-auto"
            onScroll={onScroll}
            ref={scrollerRef}
         >
            <div className="flex flex-col gap-3">
               {messages.map((message, idx) => {
                  const isLast = idx === lastIndex;
                  const isLive = isLast && isStreaming;
                  return (
                     <MessageItem
                        isLast={isLast}
                        isStreaming={isLive}
                        key={message.id}
                        message={message}
                        onApprove={approveTool}
                        onReject={rejectTool}
                     />
                  );
               })}
               {showThinking ? (
                  <div className="border-l-2 border-muted-foreground/30 px-3 py-2 text-base shimmer">
                     Montte AI está pensando…
                  </div>
               ) : null}
            </div>
         </div>
         {!isAtBottom ? (
            <Button
               aria-label="Ir para o fim"
               className="absolute bottom-2 right-2 size-8 rounded-full shadow"
               onClick={scrollToBottom}
               size="icon"
               variant="secondary"
            >
               <ArrowDown className="size-4" />
            </Button>
         ) : null}
      </div>
   );
}
