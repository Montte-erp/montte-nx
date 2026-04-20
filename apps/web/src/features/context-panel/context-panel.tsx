import { Button } from "@packages/ui/components/button";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Sidebar,
   SidebarContent,
   SidebarHeader,
   SidebarManager,
} from "@packages/ui/components/sidebar";
import { useStore, shallow } from "@tanstack/react-store";
import { Check, ChevronDown, Info, X } from "lucide-react";
import type React from "react";
import { ContextPanelAction } from "./context-panel-info";
import {
   type ContextPanelTab,
   contextPanelStore,
   activeTabMetaStore,
   type PageViewSwitchConfig,
} from "./context-panel-store";
import { closeContextPanel, openContextPanel } from "./use-context-panel";

function ViewSwitchPanelAction({ config }: { config: PageViewSwitchConfig }) {
   const active =
      config.options.find((o) => o.id === config.currentView) ??
      config.options[0];

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button
               className="w-full justify-start"
               type="button"
               variant="ghost"
            >
               {active?.icon}
               <span className="flex-1 text-left">{active?.label}</span>
               <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
            <DropdownMenuLabel>Visualização</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {config.options.map((option) => (
               <DropdownMenuItem
                  className="flex items-center justify-between gap-4"
                  key={option.id}
                  onClick={() => config.onViewChange(option.id)}
               >
                  <span className="flex items-center gap-2">
                     {option.icon}
                     {option.label}
                  </span>
                  {config.currentView === option.id && (
                     <Check className="size-4" />
                  )}
               </DropdownMenuItem>
            ))}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}

function InfoContent() {
   const { renderInfoContent, pageActions, pageViewSwitch } = useStore(
      contextPanelStore,
      (s) => ({
         renderInfoContent: s.renderInfoContent,
         pageActions: s.pageActions,
         pageViewSwitch: s.pageViewSwitch,
      }),
      shallow,
   );

   const infoContent = renderInfoContent?.() ?? null;

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
            </ContextPanelHeader>
            <ContextPanelContent className="gap-1">
               {pageViewSwitch && (
                  <ViewSwitchPanelAction config={pageViewSwitch} />
               )}
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

const INFO_TAB: ContextPanelTab = {
   id: "info",
   icon: Info,
   label: "Informações",
   renderContent: () => <InfoContent />,
   order: 0,
};

function ContextPanelInner() {
   const activeTabMeta = useStore(activeTabMetaStore, (s) => s);

   const dynamicTabs = useStore(contextPanelStore, (s) => s.dynamicTabs);
   const activeTab: ContextPanelTab | undefined =
      activeTabMeta?.id === "info"
         ? INFO_TAB
         : dynamicTabs.find((t) => t.id === activeTabMeta?.id);

   return (
      <Sidebar
         className="px-0"
         collapsible="offcanvas"
         side="right"
         variant="inset"
      >
         <SidebarHeader className="bg-background rounded-t-xl">
            <div className="flex items-center gap-2">
               {activeTabMeta && (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                     <activeTabMeta.icon className="size-4 shrink-0 text-muted-foreground" />
                     <span className="text-sm font-medium truncate">
                        {activeTabMeta.label}
                     </span>
                  </div>
               )}
               <Button
                  className="shrink-0 ml-auto"
                  onClick={closeContextPanel}
                  tooltip="Fechar painel"
                  type="button"
                  variant="ghost"
               >
                  <X className="" />
               </Button>
            </div>
         </SidebarHeader>

         <SidebarContent className="h-full overflow-hidden rounded-b-xl bg-muted">
            {activeTab?.renderContent()}
         </SidebarContent>
      </Sidebar>
   );
}

export function GlobalContextPanel() {
   const isOpen = useStore(contextPanelStore, (s) => s.isOpen);

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
