import { createFileRoute, redirect } from "@tanstack/react-router";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { Button } from "@packages/ui/components/button";
import { orpc } from "@/integrations/orpc/client";
import { setActiveThread } from "../../-montte-ai/chat-store";
import { Composer } from "../../-montte-ai/composer";
import { MessageList } from "../../-montte-ai/message-list";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat/$threadId",
)({
   beforeLoad: ({ params }) => {
      if (!params.threadId || params.threadId === "new") {
         throw redirect({
            params: { slug: params.slug, teamSlug: params.teamSlug },
            to: "/$slug/$teamSlug/chat",
         });
      }
   },
   loader: ({ context, params }) =>
      context.queryClient.prefetchQuery(
         orpc.threads.getById.queryOptions({
            input: { threadId: params.threadId },
         }),
      ),
   pendingMs: 300,
   pendingComponent: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
         Carregando…
      </div>
   ),
   errorComponent: ({ reset }) => (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm">
         <span className="text-muted-foreground">
            Falha ao carregar conversa.
         </span>
         <Button onClick={reset} size="sm" variant="outline">
            Tentar novamente
         </Button>
      </div>
   ),
   component: ChatThreadPage,
});

function ChatThreadPage() {
   const { threadId } = Route.useParams();
   useIsomorphicLayoutEffect(() => {
      setActiveThread(threadId);
   }, [threadId]);

   return (
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 p-6">
         <MessageList />
         <Composer />
      </div>
   );
}
