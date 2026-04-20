import { Button } from "@packages/ui/components/button";
import { shallow, useStore } from "@tanstack/react-store";
import { cn } from "@packages/ui/lib/utils";
import { allTabMetasStore, contextPanelStore } from "./context-panel-store";
import {
   closeContextPanel,
   openContextPanel,
   setActiveTab,
} from "./use-context-panel";

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

   return (
      <div className="hidden md:flex flex-col items-center py-2 w-10 shrink-0 gap-2 border-l">
         {allTabMetas.map((tab) => (
            <Button
               className={cn(
                  "size-8 p-0",
                  isOpen &&
                     activeTabId === tab.id &&
                     "bg-accent text-accent-foreground",
               )}
               key={tab.id}
               onClick={() => handleTabClick(tab.id)}
               tooltip={tab.label}
               tooltipSide="left"
               type="button"
               variant="ghost"
            >
               <tab.icon className="size-4" />
            </Button>
         ))}
      </div>
   );
}
