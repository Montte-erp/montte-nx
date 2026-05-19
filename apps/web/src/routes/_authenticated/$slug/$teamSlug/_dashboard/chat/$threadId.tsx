import { createFileRoute, redirect } from "@tanstack/react-router";
import { Composer } from "../../-montte-ai/composer";
import { EmptyState } from "../../-montte-ai/empty-state";
import { Thread } from "../../-montte-ai/message-list";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat/$threadId",
)({
   ssr: false,
   beforeLoad: ({ params }) => {
      if (!params.threadId || params.threadId === "new") {
         throw redirect({
            params: { slug: params.slug, teamSlug: params.teamSlug },
            to: "/$slug/$teamSlug/chat",
         });
      }
   },
   component: ChatThreadPage,
});

function ChatThreadPage() {
   return (
      <div className="mx-auto flex h-[calc(100%-2rem)] w-full max-w-5xl flex-col gap-4">
         <Thread empty={<EmptyState variant="page" />}>
            <Composer />
         </Thread>
      </div>
   );
}
