import {
   SidebarInset,
   SidebarManager,
   SidebarManagerProvider,
   SidebarProvider,
} from "@packages/ui/components/sidebar";
import { cn } from "@packages/ui/lib/utils";
import { useMatches } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import type * as React from "react";
import { useJobNotifications } from "@/features/notifications/use-job-notifications";
import { ContextPanelTabContent } from "../-context-panel/context-panel";
import { ContextPanelRail } from "../-context-panel/context-panel-rail";
import { contextPanelStore } from "../-context-panel/context-panel-store";
import { AutoBugReporter } from "./feedback/auto-bug-reporter";
import { MonthlySatisfactionSurvey } from "./feedback/monthly-satisfaction-survey";
import { EarlyAccessProvider } from "@/hooks/use-early-access";
import { setCollapsed, useSidebarCollapsed } from "./hooks/use-sidebar-store";
import { AppSidebar } from "./app-sidebar";

const SIDEBAR_WIDTH_STYLE = {
   "--sidebar-width": "28rem",
} as React.CSSProperties;

function InlineContextPanel() {
   const isOpen = useStore(contextPanelStore, (s) => s.isOpen);

   return (
      <div
         className={cn(
            "hidden sm:block shrink-0 overflow-hidden transition-[width] duration-200 ease-linear",
            isOpen ? "w-[28rem]" : "w-0",
         )}
         {...(!isOpen && { inert: true })}
      >
         <div className="w-[28rem] h-full py-2 pr-2">
            <ContextPanelTabContent />
         </div>
      </div>
   );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
   useJobNotifications();

   const persistedCollapsed = useSidebarCollapsed();
   const matches = useMatches();
   const isSettingsPage = matches.some((m) =>
      m.routeId.includes("/_dashboard/settings"),
   );
   const isChatPage = matches.some((m) =>
      m.routeId.includes("/_dashboard/chat"),
   );
   const hasDedicatedSidebar = isSettingsPage || isChatPage;

   return (
      <EarlyAccessProvider>
         <SidebarManagerProvider>
            <SidebarProvider
               key={hasDedicatedSidebar ? "dedicated" : "default"}
               className="h-svh"
               defaultOpen={hasDedicatedSidebar ? false : !persistedCollapsed}
               onOpenChange={(open) => {
                  if (!hasDedicatedSidebar) setCollapsed(!open);
               }}
            >
               <SidebarManager name="main" style={SIDEBAR_WIDTH_STYLE}>
                  <AppSidebar />
               </SidebarManager>

               <SidebarInset className="flex flex-col overflow-hidden bg-sidebar">
                  <div className="flex flex-1 overflow-hidden">
                     <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-background">
                        <main
                           className={cn(
                              "relative flex-1 p-4",
                              hasDedicatedSidebar
                                 ? "overflow-hidden"
                                 : "overflow-y-auto",
                           )}
                        >
                           {children}
                        </main>
                     </div>
                  </div>
                  <AutoBugReporter />
                  <MonthlySatisfactionSurvey />
               </SidebarInset>
               {!hasDedicatedSidebar ? (
                  <>
                     <InlineContextPanel />
                     <ContextPanelRail />
                  </>
               ) : null}
            </SidebarProvider>
         </SidebarManagerProvider>
      </EarlyAccessProvider>
   );
}
