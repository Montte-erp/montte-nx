import { Button } from "@packages/ui/components/button";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelFooter,
   ContextPanelHeader,
   ContextPanelHeaderActions,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Maximize2 } from "lucide-react";
import { QueryBoundary } from "@/components/query-boundary";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import {
   resetChat,
   useActiveThreadId,
   useChatSession,
   useRecentThreads,
   loadThread,
} from "./chat-store";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { MessageList } from "./message-list";

export function AgentPanel() {
   return (
      <QueryBoundary fallback={null} errorTitle="Falha ao carregar Montte AI">
         <AgentPanelContent />
      </QueryBoundary>
   );
}

function AgentPanelContent() {
   const { slug, teamSlug } = useDashboardSlugs();
   const activeThreadId = useActiveThreadId();
   const session = useChatSession();
   const recents = useRecentThreads();

   const hasConversation = session.messages.length > 0;
   const showRecents = !activeThreadId && recents.length > 0;

   return (
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle>Montte AI</ContextPanelTitle>
            <ContextPanelHeaderActions>
               {activeThreadId ? (
                  <Button
                     aria-label="Nova conversa"
                     className="h-7 px-2 text-xs"
                     onClick={resetChat}
                     size="sm"
                     variant="ghost"
                  >
                     Nova
                  </Button>
               ) : null}
               <Button
                  aria-label="Abrir em tela cheia"
                  asChild
                  className="size-7"
                  size="icon"
                  variant="ghost"
               >
                  <Link
                     params={{
                        slug,
                        teamSlug,
                        threadId: activeThreadId ?? "new",
                     }}
                     to="/$slug/$teamSlug/chat/$threadId"
                  >
                     <Maximize2 className="size-4" />
                  </Link>
               </Button>
            </ContextPanelHeaderActions>
         </ContextPanelHeader>

         <ContextPanelContent className="flex flex-col gap-4">
            {hasConversation ? (
               <>
                  {session.pendingApprovalIds.length >= 2 ? (
                     <div className="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs">
                        <span className="flex-1">
                           {session.pendingApprovalIds.length} ações aguardando
                           aprovação
                        </span>
                        <Button
                           className="h-7 px-2 text-xs"
                           onClick={() => session.rejectAll()}
                           size="sm"
                           variant="outline"
                        >
                           Negar tudo
                        </Button>
                        <Button
                           className="h-7 px-2 text-xs"
                           onClick={() => session.approveAll()}
                           size="sm"
                        >
                           Aprovar tudo ({session.pendingApprovalIds.length})
                        </Button>
                     </div>
                  ) : null}
                  <MessageList session={session} />
                  <Composer session={session} />
               </>
            ) : (
               <>
                  <EmptyState variant="panel" />
                  <Composer session={session} />
               </>
            )}
         </ContextPanelContent>

         {showRecents ? (
            <ContextPanelFooter>
               <div className="flex items-center justify-between pb-2">
                  <span className="text-xs text-muted-foreground">
                     Conversas recentes
                  </span>
               </div>
               <ul className="flex flex-col gap-2">
                  {recents.map((thread) => {
                     const days = thread.lastMessageAt
                        ? dayjs().diff(dayjs(thread.lastMessageAt), "day")
                        : dayjs().diff(dayjs(thread.createdAt), "day");
                     return (
                        <li
                           className="flex items-center justify-between gap-2 text-xs"
                           key={thread.id}
                        >
                           <button
                              className="flex-1 truncate text-left text-foreground hover:underline"
                              onClick={() => void loadThread(thread.id)}
                              type="button"
                           >
                              {thread.title ?? "Conversa sem título"}
                           </button>
                           <span className="shrink-0 text-muted-foreground">
                              {days}d
                           </span>
                        </li>
                     );
                  })}
               </ul>
            </ContextPanelFooter>
         ) : null}
      </ContextPanel>
   );
}
