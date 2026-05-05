import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Composer } from "../../-montte-ai/composer";
import { EmptyState } from "../../-montte-ai/empty-state";
import { resetChat, useChatSession } from "../../-montte-ai/chat-store";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat/",
)({
   component: ChatIndexPage,
});

function ChatIndexPage() {
   const session = useChatSession();

   useEffect(() => {
      resetChat();
   }, []);

   return (
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 p-6">
         <EmptyState variant="page" />
         <Composer session={session} />
      </div>
   );
}
