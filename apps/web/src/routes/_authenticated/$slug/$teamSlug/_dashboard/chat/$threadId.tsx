import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import type { UIMessage } from "@tanstack/ai-react";
import { Button } from "@packages/ui/components/button";
import { orpc } from "@/integrations/orpc/client";
import { setActiveThread, useChatSession } from "../../-montte-ai/chat-store";
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
   const { data } = useSuspenseQuery(
      orpc.threads.getById.queryOptions({ input: { threadId } }),
   );
   return (
      <ThreadRunner
         initialMessages={data.messages}
         key={data.thread.id}
         threadId={data.thread.id}
      />
   );
}

function ThreadRunner({
   initialMessages,
   threadId,
}: {
   initialMessages: UIMessage[];
   threadId: string;
}) {
   useIsomorphicLayoutEffect(() => {
      setActiveThread(threadId, initialMessages);
   }, [threadId]);

   const session = useChatSession(initialMessages);

   return (
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 p-6">
         <MessageList session={session} />
         <Composer session={session} />
      </div>
   );
}
