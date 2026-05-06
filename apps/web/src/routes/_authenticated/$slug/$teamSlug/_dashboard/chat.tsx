import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";
import { getThreadsCollection } from "../-montte-ai/chat-data";
import { ChatLayout } from "./chat/-layout/chat-layout";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat",
)({
   ssr: false,
   validateSearch: z.object({
      q: z.string().catch("").default(""),
   }),
   loader: ({ context }) => getThreadsCollection(context.queryClient).preload(),
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
