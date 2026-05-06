import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Composer } from "../../-montte-ai/composer";
import { useActiveThreadId, useChatSession } from "../../-montte-ai/chat-store";
import { EmptyState } from "../../-montte-ai/empty-state";
import { MessageList } from "../../-montte-ai/message-list";
import {
   ChatThreadBody,
   ChatThreadFooter,
   ChatThreadRoot,
} from "../../-montte-ai/thread-primitives";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat/",
)({
   component: ChatIndexPage,
});

function ChatIndexPage() {
   const { slug, teamSlug } = Route.useParams();
   const navigate = useNavigate();
   const activeThreadId = useActiveThreadId();
   const { messages, isStreaming, isSubmitting } = useChatSession();

   useEffect(() => {
      if (!activeThreadId) return;
      if (isStreaming || isSubmitting) return;
      void navigate({
         params: { slug, teamSlug, threadId: activeThreadId },
         replace: true,
         to: "/$slug/$teamSlug/chat/$threadId",
      });
   }, [activeThreadId, isStreaming, isSubmitting, slug, teamSlug, navigate]);

   const hasConversation = messages.length > 0;

   return (
      <ChatThreadRoot>
         <ChatThreadBody>
            {hasConversation ? <MessageList /> : <EmptyState variant="page" />}
         </ChatThreadBody>
         <ChatThreadFooter>
            <Composer />
         </ChatThreadFooter>
      </ChatThreadRoot>
   );
}
