"use client";

import { Button } from "@packages/ui/components/button";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelHeaderActions,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import {
   Sidebar,
   SidebarContent,
   SidebarHeader,
   SidebarManager,
} from "@packages/ui/components/sidebar";
import { cn } from "@packages/ui/lib/utils";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { Info, MessageSquare, MoveDiagonalIcon, X } from "lucide-react";
import type React from "react";
import { type ContextPanelTab, contextPanelStore } from "./context-panel-store";
import { ContextPanelAction } from "./context-panel-info";
import { TecoChatTab } from "./ui/teco-chat-tab";
import {
   closeContextPanel,
   openContextPanel,
   setActiveTab,
} from "./use-context-panel";

function InfoContent() {
   const { infoContent, pageActions, pageViewSwitch } = useStore(contextPanelStore);

   const emptyState = (
      <ContextPanel>
         <ContextPanelContent className="flex items-center justify-center p-6">
            <p className="text-sm text-muted-foreground/50">Sem informações</p>
         </ContextPanelContent>
      </ContextPanel>
   );

   if (!pageActions && !pageViewSwitch) {
      return infoContent ?? emptyState;
   }

   return (
      <div className="flex flex-col h-full min-h-0 overflow-auto">
         <ContextPanel className="h-auto shrink-0">
            <ContextPanelHeader>
               <ContextPanelTitle>Ações</ContextPanelTitle>
               {pageViewSwitch && (
                  <ContextPanelHeaderActions>{pageViewSwitch}</ContextPanelHeaderActions>
               )}
            </ContextPanelHeader>
            <ContextPanelContent className="gap-1">
               {pageActions?.map((action) => (
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

function ChatContent() {
   const navigate = useNavigate();
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });

   return (
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle>Teco AI</ContextPanelTitle>
            <ContextPanelHeaderActions>
               <Button
                  className=""
                  onClick={() =>
                     navigate({
                        to: "/$slug/$teamSlug/chat",
                        params: { slug, teamSlug },
                     })
                  }
                  tooltip="Expandir chat"
                  type="button"
                  variant="outline"
               >
                  <MoveDiagonalIcon className="" />
               </Button>
            </ContextPanelHeaderActions>
         </ContextPanelHeader>
         <ContextPanelContent>
            <TecoChatTab />
         </ContextPanelContent>
      </ContextPanel>
   );
}

const CHAT_TAB: ContextPanelTab = {
   id: "chat",
   icon: MessageSquare,
   label: "Chat IA",
   content: <ChatContent />,
   order: 1,
};

const INFO_TAB: ContextPanelTab = {
   id: "info",
   icon: Info,
   label: "Informações",
   content: <InfoContent />,
   order: 0,
};

function ContextPanelInner() {
   const { activeTabId, dynamicTabs } = useStore(contextPanelStore);

   const allTabs: ContextPanelTab[] = [
      INFO_TAB,
      CHAT_TAB,
      ...dynamicTabs.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
   ];

   const activeTab = allTabs.find((t) => t.id === activeTabId) ?? allTabs[0];

   return (
      <Sidebar
         className="px-0"
         collapsible="offcanvas"
         side="right"
         variant="inset"
      >
         <SidebarHeader className="bg-background rounded-t-xl">
            <div className="flex-row flex  items-center gap-2 ">
               <>
                  {allTabs.map((tab) => (
                     <Button
                        className={cn(
                           "",
                           activeTabId === tab.id &&
                           "bg-accent text-accent-foreground",
                        )}
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        tooltip={tab.label}
                        tooltipSide="bottom"
                        type="button"
                        variant="outline"
                     >
                        <tab.icon className="" />
                     </Button>
                  ))}
                  <div className="flex-1" />
                  <Button
                     onClick={closeContextPanel}
                     tooltip="Fechar painel"
                     type="button"
                     variant="outline"
                  >
                     <X className="" />
                  </Button>
               </>
            </div>
         </SidebarHeader>

         {/* Active tab content — inset rounded card on bg-muted */}
         <SidebarContent className="h-full overflow-hidden rounded-b-xl bg-muted">
            {activeTab?.content}
         </SidebarContent>
      </Sidebar>
   );
}

export function GlobalContextPanel() {
   const { isOpen } = useStore(contextPanelStore);

   return (
      <SidebarManager
         name="context-panel"
         onOpenChange={(open) =>
            open ? openContextPanel() : closeContextPanel()
         }
         open={isOpen}
         style={{ "--sidebar-width": "28rem" } as React.CSSProperties}
      >
         <ContextPanelInner />
      </SidebarManager>
   );
}
