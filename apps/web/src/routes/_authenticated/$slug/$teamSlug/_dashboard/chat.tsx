import { createFileRoute } from "@tanstack/react-router";
import { AgentPanel } from "@/features/agent-panel/agent-panel";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat",
)({
   head: () => ({
      meta: [{ title: "Montte AI — Montte" }],
   }),
   component: ChatPage,
});

function ChatPage() {
   return (
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
         <AgentPanel />
      </div>
   );
}
