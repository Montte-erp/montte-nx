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
      <div className="absolute right-3 top-20 hidden md:flex flex-col gap-2 z-10">
         {allTabMetas.map((tab) => (
            <Button
               className={cn(
                  "size-9 rounded-full shadow-sm border bg-background hover:bg-accent",
                  isOpen &&
                     activeTabId === tab.id &&
                     "bg-primary text-primary-foreground hover:bg-primary/90 border-primary shadow-md",
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
