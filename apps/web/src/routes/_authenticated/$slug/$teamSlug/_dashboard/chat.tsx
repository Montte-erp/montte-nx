import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";
import { ChatLayout } from "./chat/-layout/chat-layout";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat",
)({
   validateSearch: z.object({
      q: z.string().catch("").default(""),
   }),
   loader: ({ context }) =>
      context.queryClient.prefetchQuery(
         orpc.threads.list.queryOptions({ input: { limit: 50 } }),
      ),
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
