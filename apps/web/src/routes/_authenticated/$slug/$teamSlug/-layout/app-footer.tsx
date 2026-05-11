import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import dayjs from "dayjs";
import {
   ExternalLink,
   HelpCircle,
   History,
   Keyboard,
   Sparkles,
} from "lucide-react";
import { useState } from "react";
import { POSTHOG_SURVEYS } from "@core/posthog/config";
import { LogoDevAttribution } from "@/components/logo-dev-attribution";
import { useSurveyModal } from "@/hooks/use-survey-modal";
import { setActiveThread, useRecentThreads } from "../-montte-ai/chat-store";
import { AgentPanel } from "../-montte-ai/panel";
import { openKeyboardShortcuts } from "./keyboard-shortcuts-sheet";

function HelpMenu() {
   const { openSurveyModal } = useSurveyModal();

   return (
      <DropdownMenu>
         <Tooltip>
            <TooltipTrigger asChild>
               <DropdownMenuTrigger asChild>
                  <Button
                     aria-label="Ajuda"
                     className="size-7"
                     size="icon"
                     variant="ghost"
                  >
                     <HelpCircle className="size-4" />
                  </Button>
               </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Ajuda</TooltipContent>
         </Tooltip>
         <DropdownMenuContent align="start" side="top">
            <DropdownMenuLabel>Ajuda</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
               className="cursor-pointer gap-2"
               onClick={openKeyboardShortcuts}
            >
               <Keyboard className="size-4" />
               Atalhos de teclado
            </DropdownMenuItem>
            <DropdownMenuItem
               className="cursor-pointer gap-2"
               onClick={() =>
                  openSurveyModal(POSTHOG_SURVEYS.featureRequest.id)
               }
            >
               <Sparkles className="size-4" />
               Dar feedback
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer gap-2">
               <a
                  href="https://montte.co/docs"
                  rel="noopener noreferrer"
                  target="_blank"
               >
                  <ExternalLink className="size-4" />
                  Documentação
               </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer gap-2">
               <LogoDevAttribution className="flex items-center gap-2" />
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}

function HistoryMenu({ onOpenThread }: { onOpenThread: (id: string) => void }) {
   const recents = useRecentThreads();

   return (
      <DropdownMenu>
         <Tooltip>
            <TooltipTrigger asChild>
               <DropdownMenuTrigger asChild>
                  <Button
                     aria-label="Histórico de conversas"
                     className="size-7"
                     size="icon"
                     variant="ghost"
                  >
                     <History className="size-4" />
                  </Button>
               </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Conversas recentes</TooltipContent>
         </Tooltip>
         <DropdownMenuContent align="end" className="w-72" side="top">
            <DropdownMenuLabel>Conversas recentes</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {recents.length === 0 ? (
               <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  Sem conversas
               </div>
            ) : (
               recents.map((thread) => {
                  const days = thread.lastMessageAt
                     ? dayjs().diff(dayjs(thread.lastMessageAt), "day")
                     : dayjs().diff(dayjs(thread.createdAt), "day");
                  return (
                     <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        key={thread.id}
                        onClick={() => onOpenThread(thread.id)}
                     >
                        <span className="flex-1 truncate">
                           {thread.title ?? "Conversa sem título"}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                           {days}d
                        </span>
                     </DropdownMenuItem>
                  );
               })
            )}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}

function MontteAITrigger() {
   const [open, setOpen] = useState(false);

   const handleOpenThread = (threadId: string) => {
      setActiveThread(threadId);
      setOpen(true);
   };

   return (
      <div className="flex items-center gap-1">
         <Popover onOpenChange={setOpen} open={open}>
            <PopoverTrigger asChild>
               <Button
                  className="h-7 gap-2 px-2 text-xs"
                  size="sm"
                  variant="ghost"
               >
                  <img
                     alt=""
                     aria-hidden="true"
                     className="size-4"
                     draggable={false}
                     src="/mascot.svg"
                  />
                  Pergunte ao Montte
               </Button>
            </PopoverTrigger>
            <PopoverContent
               align="end"
               className="h-[600px] w-[465px] overflow-hidden p-0"
               side="top"
               sideOffset={8}
            >
               <AgentPanel />
            </PopoverContent>
         </Popover>
         <HistoryMenu onOpenThread={handleOpenThread} />
      </div>
   );
}

export function AppFooter() {
   return (
      <footer className="flex h-8 shrink-0 items-center justify-between gap-2 border-t bg-sidebar px-2">
         <div className="flex items-center gap-1">
            <HelpMenu />
         </div>
         <MontteAITrigger />
      </footer>
   );
}
