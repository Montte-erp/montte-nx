import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Composer } from "../../-montte-ai/composer";
import {
   useActiveThreadId,
   useMontteAssistant,
} from "../../-montte-ai/chat-store";
import { EmptyState } from "../../-montte-ai/empty-state";
import { MessageList } from "../../-montte-ai/message-list";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat/",
)({
   head: () => ({ meta: [{ title: "Chat — Montte" }] }),
   component: ChatIndexPage,
});

function ChatIndexPage() {
   const { slug, teamSlug } = useDashboardSlugs();
   const navigate = useNavigate();
   const activeThreadId = useActiveThreadId();
   const { messageCount, isRunning } = useMontteAssistant();

   useEffect(() => {
      if (!activeThreadId) return;
      if (isRunning) return;
      void navigate({
         params: { slug, teamSlug, threadId: activeThreadId },
         replace: true,
         to: "/$slug/$teamSlug/chat/$threadId",
      });
   }, [activeThreadId, isRunning, slug, teamSlug, navigate]);

   const hasConversation = messageCount > 0;

   return (
      <div className="flex h-full w-full max-w-5xl flex-col gap-4 p-4">
         <div className="flex min-h-0 flex-1 flex-col">
            {hasConversation ? <MessageList /> : <EmptyState variant="page" />}
         </div>
         <div className="shrink-0">
            <Composer />
         </div>
      </div>
   );
}
