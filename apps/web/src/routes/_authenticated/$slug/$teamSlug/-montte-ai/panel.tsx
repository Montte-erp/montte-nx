import { Button } from "@packages/ui/components/button";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelFooter,
   ContextPanelHeader,
   ContextPanelHeaderActions,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Maximize2 } from "lucide-react";
import { useEffect } from "react";
import { QueryBoundary } from "@/components/query-boundary";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import {
   SelectionActionButton,
   useSelectionToolbar,
} from "@/hooks/use-selection-toolbar";
import {
   setActiveThread,
   togglePanel,
   useActiveThreadId,
   useMontteActions,
   useMontteIsRunning,
   useMontteMessageCount,
   useMonttePendingApprovals,
   useRecentThreads,
} from "./chat-store";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { MessageList } from "./message-list";

export function AgentPanel() {
   useHotkey("Mod+J", togglePanel);
   useHotkey("Mod+Shift+J", () => {
      setActiveThread(null);
      togglePanel();
   });
   return (
      <QueryBoundary
         fallback={<PanelSkeleton />}
         errorTitle="Falha ao carregar Montte AI"
      >
         <AgentPanelContent />
      </QueryBoundary>
   );
}

function PanelSkeleton() {
   return (
      <div className="flex flex-col gap-4 p-4">
         <Skeleton className="h-6 w-32" />
         <Skeleton className="h-16 w-full" />
         <Skeleton className="h-24 w-3/4" />
         <Skeleton className="h-20 w-full" />
      </div>
   );
}

function AgentPanelContent() {
   const activeThreadId = useActiveThreadId();
   const { slug, teamSlug } = useDashboardSlugs();
   const messageCount = useMontteMessageCount();
   const recents = useRecentThreads();

   useApprovalSelectionBar();
   useStreamShortcuts();

   const hasConversation = messageCount > 0;
   const showRecents = !activeThreadId && recents.length > 0;

   return (
      <ContextPanel className="overflow-hidden">
         <ContextPanelHeader>
            <ContextPanelTitle>Montte AI</ContextPanelTitle>
            <ContextPanelHeaderActions>
               {activeThreadId ? (
                  <Button
                     aria-label="Nova conversa"
                     className="h-7 px-2 text-xs"
                     onClick={() => setActiveThread(null)}
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

         <ContextPanelContent className="overflow-hidden">
            {hasConversation ? (
               <>
                  <div className="flex min-h-0 flex-1 flex-col">
                     <MessageList compact />
                  </div>
                  <div className="shrink-0">
                     <Composer />
                  </div>
               </>
            ) : (
               <>
                  <div className="flex min-h-0 flex-1 flex-col">
                     <EmptyState variant="panel" />
                  </div>
                  <div className="shrink-0">
                     <Composer />
                  </div>
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
                              onClick={() => setActiveThread(thread.id)}
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

function useApprovalSelectionBar() {
   const { approveTool, rejectTool } = useMontteActions();
   const ids = useMonttePendingApprovals();

   const toolbar = useSelectionToolbar(({ selectedIndices, clear }) => (
      <>
         <SelectionActionButton
            onClick={async () => {
               for (const i of selectedIndices) {
                  const id = ids[i];
                  if (id !== undefined) await rejectTool(id);
               }
               clear();
            }}
         >
            Negar
         </SelectionActionButton>
         <SelectionActionButton
            onClick={async () => {
               for (const i of selectedIndices) {
                  const id = ids[i];
                  if (id !== undefined) await approveTool(id);
               }
               clear();
            }}
         >
            Aprovar ({selectedIndices.size})
         </SelectionActionButton>
      </>
   ));

   useEffect(() => {
      if (ids.length >= 2) {
         toolbar.replace(new Set(ids.map((_, i) => i)));
         return;
      }
      toolbar.clear();
      // oxlint-disable-next-line react-hooks/exhaustive-deps
   }, [ids.length]);
}

function useStreamShortcuts() {
   const { stop } = useMontteActions();
   const isRunning = useMontteIsRunning();
   useHotkey("Escape", () => {
      if (isRunning) stop();
   });
}
