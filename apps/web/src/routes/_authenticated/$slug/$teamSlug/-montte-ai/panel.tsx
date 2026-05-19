import { Button } from "@packages/ui/components/button";
import { FeatureStageBadge } from "@/components/blocks/feature-stage-badge";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelHeaderActions,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useAui } from "@assistant-ui/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link } from "@tanstack/react-router";
import { Maximize2, Minus, X } from "lucide-react";
import { useEffect } from "react";
import { QueryBoundary } from "@/components/query-boundary";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import {
   SelectionActionButton,
   useSelectionToolbar,
} from "@/hooks/use-selection-toolbar";
import {
   useCurrentRemoteThreadId,
   useMontteActions,
   useMontteIsRunning,
   useMonttePendingApprovals,
} from "./chat-runtime";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { Thread } from "./message-list";
import { ThreadList } from "./thread-list";

interface AgentPanelProps {
   onMinimize?: () => void;
   onClose?: () => void;
}

export function AgentPanel({ onMinimize, onClose }: AgentPanelProps = {}) {
   const aui = useAui();
   useHotkey("Mod+J", () => onMinimize?.());
   useHotkey("Mod+Shift+J", () => {
      void aui.threads().switchToNewThread();
   });
   return (
      <QueryBoundary
         fallback={<PanelSkeleton />}
         errorTitle="Falha ao carregar Montte AI"
      >
         <AgentPanelContent onClose={onClose} onMinimize={onMinimize} />
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

function AgentPanelContent({ onMinimize, onClose }: AgentPanelProps) {
   const aui = useAui();
   const activeThreadId = useCurrentRemoteThreadId();
   const { slug, teamSlug } = useDashboardSlugs();

   useApprovalSelectionBar();
   useStreamShortcuts();

   return (
      <ContextPanel className="overflow-hidden">
         <ContextPanelHeader>
            <ContextPanelTitle className="flex items-center gap-2">
               Montte AI
               <FeatureStageBadge stage="alpha" />
            </ContextPanelTitle>
            <ContextPanelHeaderActions>
               {activeThreadId ? (
                  <Button
                     aria-label="Nova conversa"
                     className="h-7 px-2 text-xs"
                     onClick={() => void aui.threads().switchToNewThread()}
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
               {onMinimize ? (
                  <Button
                     aria-label="Minimizar"
                     className="size-7"
                     onClick={onMinimize}
                     size="icon"
                     variant="ghost"
                  >
                     <Minus className="size-4" />
                  </Button>
               ) : null}
               {onClose ? (
                  <Button
                     aria-label="Fechar"
                     className="size-7"
                     onClick={onClose}
                     size="icon"
                     variant="ghost"
                  >
                     <X className="size-4" />
                  </Button>
               ) : null}
            </ContextPanelHeaderActions>
         </ContextPanelHeader>

         <ContextPanelContent className="overflow-hidden">
            <div className="grid min-h-0 flex-1 grid-cols-[150px_1fr] gap-2">
               <div className="min-h-0 border-r pr-2">
                  <ThreadList />
               </div>
               <div className="flex min-h-0 flex-1 flex-col">
                  <Thread compact empty={<EmptyState variant="panel" />}>
                     <Composer />
                  </Thread>
               </div>
            </div>
         </ContextPanelContent>
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
