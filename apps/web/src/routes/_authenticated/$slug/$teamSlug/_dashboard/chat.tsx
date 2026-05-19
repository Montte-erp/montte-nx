import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ChatLayout } from "./chat/-layout/chat-layout";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat",
)({
   ssr: false,
   head: () => ({
      meta: [{ title: "Montte AI — Montte" }],
   }),
   component: ChatLayoutRoute,
});

function ChatLayoutRoute() {
   return (
      <ChatLayout>
         <Outlet />
      </ChatLayout>
   );
}
