import { Button } from "@packages/ui/components/button";
import { ArrowDown, RefreshCw } from "lucide-react";
import { useChatSession } from "./chat-store";
import { MessageItem } from "./message-item";
import { useStickToBottom } from "./use-stick-to-bottom";

export function MessageList() {
   const { ref, onScroll, scrollToBottom, atBottom } = useStickToBottom();
   const session = useChatSession();
   const {
      messages,
      isStreaming,
      isSubmitting,
      error,
      approveTool,
      rejectTool,
      regenerate,
      metadataFor,
      sendMessage,
   } = session;
   const lastIndex = messages.length - 1;
   const last = messages.at(-1);
   const showThinking = isSubmitting || (isStreaming && last?.role === "user");

   const showError =
      error !== null && !isStreaming && !isSubmitting && messages.length > 0;

   return (
      <div className="relative flex flex-1 min-h-0 flex-col">
         <div className="flex-1 overflow-y-auto" onScroll={onScroll} ref={ref}>
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
                        metadata={metadataFor(message.id)}
                        onApprove={approveTool}
                        onReject={rejectTool}
                        onSendFollowUp={sendMessage}
                     />
                  );
               })}
               {showThinking ? (
                  <div className="border-l-2 border-muted-foreground/30 px-3 py-2 text-base shimmer">
                     Montte AI está pensando…
                  </div>
               ) : null}
               {showError ? (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                     <span className="flex-1 text-destructive">
                        Falha ao gerar resposta.
                     </span>
                     <Button
                        className="h-7 px-2 text-xs"
                        onClick={() => void regenerate()}
                        size="sm"
                        variant="outline"
                     >
                        <RefreshCw className="size-3" />
                        Tentar novamente
                     </Button>
                  </div>
               ) : null}
            </div>
         </div>
         {!atBottom ? (
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
