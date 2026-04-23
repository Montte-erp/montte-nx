import {
   SidebarInset,
   SidebarManager,
   SidebarManagerProvider,
   SidebarProvider,
} from "@packages/ui/components/sidebar";
import { cn } from "@packages/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import type * as React from "react";
import { useEffect } from "react";
import { useSingleton } from "foxact/use-singleton";
import { useJobNotifications } from "@/features/notifications/use-job-notifications";
import { ContextPanelTabContent } from "@/features/context-panel/context-panel";
import { contextPanelStore } from "@/features/context-panel/context-panel-store";
import { ContextPanelRail } from "@/features/context-panel/context-panel-rail";
import { AutoBugReporter } from "@/features/feedback/ui/auto-bug-reporter";
import { MonthlySatisfactionSurvey } from "@/features/feedback/ui/monthly-satisfaction-survey";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useActiveTeam } from "@/hooks/use-active-team";
import { EarlyAccessProvider } from "@/hooks/use-early-access";
import { useLastOrganization } from "@/hooks/use-last-organization";
import { authClient } from "@/integrations/better-auth/auth-client";
import { useSidebarCollapsed } from "@/layout/dashboard/hooks/use-sidebar-store";
import { orpc } from "@/integrations/orpc/client";
import { AppSidebar } from "./app-sidebar";
import { SidebarSubPanel } from "./sidebar-sub-panel";

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
         <div className="w-[28rem] h-full pl-0 py-2 pr-2">
            <ContextPanelTabContent />
         </div>
      </div>
   );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
   const { activeOrganization } = useActiveOrganization();
   const { activeTeam, teams } = useActiveTeam();
   const { setLastSlug } = useLastOrganization();
   const queryClient = useQueryClient();
   const setTeamForOrgRef = useSingleton(() => new Set<string>());
   useJobNotifications();
   const { pathname } = useLocation();

   const { isCollapsed, setCollapsed } = useSidebarCollapsed();
   const sidebarOpen = !isCollapsed;
   const handleSidebarChange = (open: boolean) => {
      setCollapsed(!open);
   };

   const isSettingsPage = pathname.includes("/settings");

   useEffect(() => {
      if (activeOrganization?.slug) {
         setLastSlug(activeOrganization.slug);
      }
   }, [activeOrganization?.slug, setLastSlug]);

   useEffect(() => {
      const orgId = activeOrganization?.id;
      if (!orgId) return;
      if (activeTeam || teams.length === 0) return;
      if (setTeamForOrgRef.current.has(orgId)) return;

      setTeamForOrgRef.current.add(orgId);

      const setDefaultTeam = async () => {
         await authClient.organization.setActiveTeam({
            teamId: teams[0]?.id,
         });

         await queryClient.invalidateQueries({
            queryKey: orpc.session.getSession.queryKey({}),
         });
      };

      void setDefaultTeam();
   }, [activeOrganization?.id, activeTeam, queryClient, teams]);

   return (
      <EarlyAccessProvider>
         <SidebarManagerProvider>
            <SidebarProvider
               className="h-svh"
               onOpenChange={handleSidebarChange}
               open={sidebarOpen}
            >
               <SidebarManager
                  name="main"
                  style={
                     {
                        "--sidebar-width": "28rem",
                     } as React.CSSProperties
                  }
               >
                  <AppSidebar />
               </SidebarManager>

               <SidebarInset className="flex flex-col overflow-hidden bg-sidebar mr-0">
                  <SidebarSubPanel />
                  <div className="flex flex-1 overflow-hidden">
                     <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-background">
                        <main
                           className={cn(
                              "relative flex-1",
                              isSettingsPage
                                 ? "overflow-hidden p-4"
                                 : "overflow-y-auto p-4",
                           )}
                        >
                           {children}
                        </main>
                     </div>
                  </div>
                  <AutoBugReporter />
                  <MonthlySatisfactionSurvey />
               </SidebarInset>
               <InlineContextPanel />
               <ContextPanelRail />
            </SidebarProvider>
         </SidebarManagerProvider>
      </EarlyAccessProvider>
   );
}
