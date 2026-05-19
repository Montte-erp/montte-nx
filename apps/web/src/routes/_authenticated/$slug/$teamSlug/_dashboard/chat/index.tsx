import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Composer } from "../../-montte-ai/composer";
import {
   useCurrentRemoteThreadId,
   useMontteIsRunning,
} from "../../-montte-ai/chat-runtime";
import { EmptyState } from "../../-montte-ai/empty-state";
import { Thread } from "../../-montte-ai/message-list";
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
   const activeThreadId = useCurrentRemoteThreadId();
   const isRunning = useMontteIsRunning();

   useEffect(() => {
      if (!activeThreadId) return;
      if (isRunning) return;
      void navigate({
         params: { slug, teamSlug, threadId: activeThreadId },
         replace: true,
         to: "/$slug/$teamSlug/chat/$threadId",
      });
   }, [activeThreadId, isRunning, slug, teamSlug, navigate]);

   return (
      <div className="self-center flex h-full w-full max-w-5xl flex-col gap-4">
         <Thread empty={<EmptyState variant="page" />}>
            <Composer />
         </Thread>
      </div>
   );
}
