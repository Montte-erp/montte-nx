import { fetchHttpStream, useChat, type UIMessage } from "@tanstack/ai-react";
import { useMemo, useRef } from "react";
import { toast } from "sonner";
import type { Outputs } from "@/integrations/orpc/client";

type ChatMessageMetadata =
   Outputs["threads"]["getById"]["messages"][number]["metadata"];
type ChatPageContext = NonNullable<
   NonNullable<ChatMessageMetadata>["pageContext"]
>;

export type ChatTurnRequest = {
   text?: string;
   regenerate?: boolean;
   replaceFromMessageId?: string;
};

interface ChatRuntimeOptions {
   getThreadId: () => string | null;
   getPageContext: () => ChatPageContext | undefined;
   onFinish: () => Promise<void>;
}

export function useChatRuntime(options: ChatRuntimeOptions) {
   const pendingTurn = useRef<ChatTurnRequest | null>(null);
   const optionsRef = useRef(options);
   optionsRef.current = options;

   const connection = useMemo(
      () =>
         fetchHttpStream("/api/chat", () => {
            const turn = pendingTurn.current;
            pendingTurn.current = null;
            return {
               credentials: "include",
               body: {
                  threadId: optionsRef.current.getThreadId() ?? "",
                  ...(turn?.text !== undefined && { text: turn.text }),
                  ...(turn?.regenerate && { regenerate: true }),
                  ...(turn?.replaceFromMessageId && {
                     replaceFromMessageId: turn.replaceFromMessageId,
                  }),
                  pageContext: optionsRef.current.getPageContext(),
               },
            };
         }),
      [],
   );

   const chat = useChat({
      connection,
      initialMessages: [],
      onFinish: () => optionsRef.current.onFinish(),
      onError: () => toast.error("Falha no streaming da Montte AI."),
   });

   return {
      chat,
      prepareTurn: (turn: ChatTurnRequest) => {
         pendingTurn.current = turn;
      },
      clearOverlay: () => chat.setMessages([]),
      setOverlay: (messages: UIMessage[]) => chat.setMessages(messages),
   };
}
