import {
   ContextPanel,
   ContextPanelContent,
} from "@packages/ui/components/context-panel";
import {
   Sidebar,
   SidebarContent,
   SidebarManager,
} from "@packages/ui/components/sidebar";
import { useSelector } from "@tanstack/react-store";
import type React from "react";
import { AgentPanel } from "../-montte-ai/panel";
import { ContextPanelAction } from "./context-panel-info";
import { contextPanelStore } from "./context-panel-store";
import { closeContextPanel, openContextPanel } from "./use-context-panel";

function InfoContent() {
   const { renderInfoContent, pageActions } = useSelector(
      contextPanelStore,
      (s) => ({
         renderInfoContent: s.renderInfoContent,
         pageActions: s.pageActions,
      }),
   );

   const infoContent = renderInfoContent?.() ?? null;

   if (!pageActions) {
      return (
         infoContent ?? (
            <ContextPanel>
               <ContextPanelContent className="flex items-center justify-center p-6">
                  <p className="text-sm text-muted-foreground/50">
                     Sem informações
                  </p>
               </ContextPanelContent>
            </ContextPanel>
         )
      );
   }

   return (
      <div className="flex flex-col h-full min-h-0 overflow-auto">
         <ContextPanel className="h-auto shrink-0">
            <ContextPanelContent className="gap-1">
               {pageActions.map((action) => (
                  <ContextPanelAction
                     icon={action.icon}
                     key={action.label}
                     label={action.label}
                     onClick={action.onClick}
                  />
               ))}
            </ContextPanelContent>
         </ContextPanel>
         {infoContent && <div className="flex-1 min-h-0">{infoContent}</div>}
      </div>
   );
}

function ActiveTab() {
   const activeTabId = useSelector(contextPanelStore, (s) => s.activeTabId);
   if (activeTabId === "agent") return <AgentPanel />;
   return <InfoContent />;
}

export function GlobalContextPanel() {
   const isOpen = useSelector(contextPanelStore, (s) => s.isOpen);

   return (
      <SidebarManager
         name="context-panel"
         onOpenChange={(open) =>
            open ? openContextPanel() : closeContextPanel()
         }
         open={isOpen}
         style={{ "--sidebar-width": "28rem" } as React.CSSProperties}
      >
         <Sidebar
            className="p-0 overflow-y-scroll"
            collapsible="offcanvas"
            side="right"
            variant="inset"
         >
            <SidebarContent className="h-full overflow-x-hidden overflow-y-scroll rounded-lg bg-muted">
               <ActiveTab />
            </SidebarContent>
         </Sidebar>
      </SidebarManager>
   );
}

export function ContextPanelTabContent() {
   return (
      <div className="h-full overflow-hidden rounded-xl bg-muted">
         <ActiveTab />
      </div>
   );
}
