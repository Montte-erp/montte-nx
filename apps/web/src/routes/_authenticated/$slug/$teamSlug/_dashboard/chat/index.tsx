import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Composer } from "../../-montte-ai/composer";
import { useActiveThreadId, useChatSession } from "../../-montte-ai/chat-store";
import { EmptyState } from "../../-montte-ai/empty-state";
import { MessageList } from "../../-montte-ai/message-list";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat/",
)({
   component: ChatIndexPage,
});

function ChatIndexPage() {
   const activeThreadId = useActiveThreadId();
   return <ChatRunner key={activeThreadId ?? "new"} />;
}

function ChatRunner() {
   const { slug, teamSlug } = Route.useParams();
   const navigate = useNavigate();
   const activeThreadId = useActiveThreadId();
   const session = useChatSession();

   useEffect(() => {
      if (!activeThreadId) return;
      if (session.isStreaming || session.isSubmitting) return;
      void navigate({
         params: { slug, teamSlug, threadId: activeThreadId },
         replace: true,
         to: "/$slug/$teamSlug/chat/$threadId",
      });
   }, [
      activeThreadId,
      session.isStreaming,
      session.isSubmitting,
      slug,
      teamSlug,
      navigate,
   ]);

   const hasConversation = session.messages.length > 0;

   return (
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 p-6">
         {hasConversation ? (
            <MessageList session={session} />
         ) : (
            <EmptyState variant="page" />
         )}
         <Composer session={session} />
      </div>
   );
}
