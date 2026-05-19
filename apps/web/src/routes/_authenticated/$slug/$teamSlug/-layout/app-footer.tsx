import { Button } from "@packages/ui/components/button";
import { AssistantModalPrimitive } from "@assistant-ui/react";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   ExternalLink,
   HelpCircle,
   History,
   Keyboard,
   Sparkles,
} from "lucide-react";
import { Activity, useState } from "react";
import { POSTHOG_SURVEYS } from "@core/posthog/config";
import { LogoDevAttribution } from "@/components/logo-dev-attribution";
import { useSurveyModal } from "@/hooks/use-survey-modal";
import { useCurrentRemoteThreadId } from "../-montte-ai/chat-runtime";
import { AgentPanel } from "../-montte-ai/panel";
import { ThreadList } from "../-montte-ai/thread-list";
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
         <DropdownMenuContent align="end" side="top">
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

function HistoryButton({ onSelectThread }: { onSelectThread: () => void }) {
   const [open, setOpen] = useState(false);

   return (
      <Popover onOpenChange={setOpen} open={open}>
         <Tooltip>
            <TooltipTrigger asChild>
               <PopoverTrigger asChild>
                  <Button
                     aria-label="Histórico de conversas"
                     className="size-7"
                     size="icon"
                     variant="ghost"
                  >
                     <History className="size-4" />
                  </Button>
               </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Conversas recentes</TooltipContent>
         </Tooltip>
         <PopoverContent
            align="end"
            className="flex h-80 w-64 flex-col overflow-hidden p-2"
            side="top"
            sideOffset={8}
         >
            <ThreadList
               onSelectThread={() => {
                  setOpen(false);
                  onSelectThread();
               }}
               showActions={false}
               showNew={false}
            />
         </PopoverContent>
      </Popover>
   );
}

function MontteAITrigger() {
   const [open, setOpen] = useState(false);
   const activeThreadId = useCurrentRemoteThreadId();

   const handleClose = () => {
      setOpen(false);
   };

   return (
      <div className="flex items-center gap-1">
         <AssistantModalPrimitive.Root onOpenChange={setOpen} open={open}>
            <AssistantModalPrimitive.Anchor>
               <AssistantModalPrimitive.Trigger asChild>
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
               </AssistantModalPrimitive.Trigger>
            </AssistantModalPrimitive.Anchor>
            <AssistantModalPrimitive.Content
               align="end"
               className="z-50 h-[600px] w-[620px] overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-md outline-none"
               side="top"
               sideOffset={8}
            >
               <Activity key={activeThreadId ?? "new"} mode="visible">
                  <AgentPanel
                     onClose={handleClose}
                     onMinimize={() => setOpen(false)}
                  />
               </Activity>
            </AssistantModalPrimitive.Content>
         </AssistantModalPrimitive.Root>
         <HistoryButton onSelectThread={() => setOpen(true)} />
         <HelpMenu />
      </div>
   );
}

export function AppFooter() {
   return (
      <footer className="flex h-8 shrink-0 items-center justify-end gap-2 bg-sidebar px-2">
         <MontteAITrigger />
      </footer>
   );
}
