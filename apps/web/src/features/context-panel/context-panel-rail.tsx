import { shallow, useStore } from "@tanstack/react-store";
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

   if (isOpen) return null;

   return (
      <div className="hidden md:flex flex-col shrink-0">
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
   );
}
