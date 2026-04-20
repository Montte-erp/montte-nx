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
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useSelector } from "@tanstack/react-store";
import { Ellipsis, ExternalLink, Keyboard, Sparkles, X } from "lucide-react";
import { POSTHOG_SURVEYS } from "@core/posthog/config";
import { useSurveyModal } from "@/hooks/use-survey-modal";
import { openKeyboardShortcuts } from "@/layout/dashboard/ui/keyboard-shortcuts-sheet";
import { allTabMetasStore, contextPanelStore } from "./context-panel-store";
import {
   closeContextPanel,
   openContextPanel,
   setActiveTab,
} from "./use-context-panel";

function RailMenuButton() {
   const { openSurveyModal } = useSurveyModal();

   return (
      <Tooltip>
         <DropdownMenu>
            <TooltipTrigger asChild>
               <DropdownMenuTrigger asChild>
                  <Button aria-label="Mais opções" size="icon" variant="ghost">
                     <Ellipsis className="size-4" />
                  </Button>
               </DropdownMenuTrigger>
            </TooltipTrigger>
            <DropdownMenuContent align="end" side="left">
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
            </DropdownMenuContent>
         </DropdownMenu>
         <TooltipContent side="left">Mais opções</TooltipContent>
      </Tooltip>
   );
}

export function ContextPanelRail() {
   const allTabMetas = useSelector(allTabMetasStore, (s) => s);
   const isOpen = useSelector(contextPanelStore, (s) => s.isOpen);
   const activeTabId = useSelector(contextPanelStore, (s) => s.activeTabId);

   const handleTabClick = (tabId: string) => {
      if (isOpen && activeTabId === tabId) {
         closeContextPanel();
         return;
      }
      setActiveTab(tabId);
      if (!isOpen) openContextPanel();
   };

   return (
      <div className="hidden sm:flex flex-col shrink-0 h-full">
         <div className="flex flex-col flex-1">
            {allTabMetas.map((tab) => (
               <button
                  aria-label={
                     isOpen && activeTabId === tab.id
                        ? `Fechar ${tab.label}`
                        : tab.label
                  }
                  aria-pressed={isOpen && activeTabId === tab.id}
                  className={`group flex flex-col items-center gap-2 px-2 py-4 transition-colors rounded-md cursor-pointer ${isOpen && activeTabId === tab.id ? "bg-accent text-foreground hover:bg-destructive/10 hover:text-destructive" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  type="button"
               >
                  {isOpen && activeTabId === tab.id ? (
                     <>
                        <X className="size-4 shrink-0 hidden group-hover:block" />
                        <tab.icon className="size-4 shrink-0 group-hover:hidden" />
                     </>
                  ) : (
                     <tab.icon className="size-4 shrink-0" />
                  )}
                  <span className="text-xs font-medium [writing-mode:vertical-lr]">
                     {tab.label}
                  </span>
               </button>
            ))}
         </div>
         <RailMenuButton />
      </div>
   );
}
