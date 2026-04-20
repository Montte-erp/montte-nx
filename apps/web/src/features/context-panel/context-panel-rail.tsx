import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { shallow, useStore } from "@tanstack/react-store";
import { Ellipsis, ExternalLink, Sparkles } from "lucide-react";
import { useState } from "react";
import { POSTHOG_SURVEYS } from "@core/posthog/config";
import { useSurveyModal } from "@/hooks/use-survey-modal";
import { allTabMetasStore, contextPanelStore } from "./context-panel-store";
import {
   closeContextPanel,
   openContextPanel,
   setActiveTab,
} from "./use-context-panel";

function RailMenuButton() {
   const [open, setOpen] = useState(false);
   const { openSurveyModal } = useSurveyModal();

   const handleFeedback = () => {
      setOpen(false);
      openSurveyModal(POSTHOG_SURVEYS.featureRequest.id);
   };

   return (
      <Popover onOpenChange={setOpen} open={open}>
         <PopoverTrigger asChild>
            <button
               className="flex flex-col items-center px-2 py-3 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground w-full"
               type="button"
            >
               <Ellipsis className="size-4" />
            </button>
         </PopoverTrigger>
         <PopoverContent align="end" className="w-auto p-1" side="left">
            <Button
               className="w-full justify-start gap-2"
               onClick={handleFeedback}
               variant="ghost"
            >
               <Sparkles className="size-4" />
               Sugestão de funcionalidade
            </Button>
            <Button
               asChild
               className="w-full justify-start gap-2"
               variant="ghost"
            >
               <a
                  href="https://docs.montte.app"
                  rel="noopener noreferrer"
                  target="_blank"
               >
                  <ExternalLink className="size-4" />
                  Documentação
               </a>
            </Button>
         </PopoverContent>
      </Popover>
   );
}

export function ContextPanelRail() {
   const allTabMetas = useStore(allTabMetasStore, (s) => s, shallow);
   const isOpen = useStore(contextPanelStore, (s) => s.isOpen);
   const activeTabId = useStore(contextPanelStore, (s) => s.activeTabId);

   const handleTabClick = (tabId: string) => {
      if (isOpen && activeTabId === tabId) {
         closeContextPanel();
         return;
      }
      setActiveTab(tabId);
      if (!isOpen) openContextPanel();
   };

   if (isOpen) return null;

   return (
      <div className="hidden md:flex flex-col shrink-0 justify-between">
         <div className="flex flex-col">
            {allTabMetas.map((tab) => (
               <button
                  className="flex flex-col items-center gap-2 px-2 py-4 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  type="button"
               >
                  <tab.icon className="size-4 shrink-0" />
                  <span
                     className="text-xs font-medium leading-none"
                     style={{ writingMode: "vertical-lr" }}
                  >
                     {tab.label}
                  </span>
               </button>
            ))}
         </div>
         <RailMenuButton />
      </div>
   );
}
