import { SidebarInset, SidebarProvider } from "@packages/ui/components/sidebar";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { cn } from "@packages/ui/lib/utils";
import type * as React from "react";
import { useEffect, useMemo } from "react";
import { useDashboardTabs } from "@/features/dashboard/hooks/use-dashboard-tabs";
import { useTabRouteSync } from "@/features/dashboard/hooks/use-tab-route-sync";
import { useIsStandalone } from "@/features/pwa/lib/use-standalone";
import { PWAInstallPrompt } from "@/features/pwa/ui/pwa-install-prompt";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useBillReminderCheck } from "@/hooks/use-bill-reminder-check";
import { useLastOrganization } from "@/hooks/use-last-organization";
import { AppSidebar } from "./app-sidebar";
import { BottomNavigation } from "./bottom-navigation";
import { SiteHeader } from "./site-header";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
   const isMobile = useIsMobile();
   const isStandalone = useIsStandalone();
   const showBottomNav = isMobile;
   const showPWAPrompt = isMobile && !isStandalone;

   const { activeOrganization } = useActiveOrganization();
   const { setLastSlug } = useLastOrganization();

   // Sync active tab with current route
   useTabRouteSync();

   useBillReminderCheck();

   useEffect(() => {
      if (activeOrganization?.slug) {
         setLastSlug(activeOrganization.slug);
      }
   }, [activeOrganization?.slug, setLastSlug]);

   return (
      <SidebarProvider className="h-screen" defaultOpen={false}>
         {!showBottomNav && <AppSidebar variant="inset" />}
         <SidebarInset className=" overflow-hidden">
            <SiteHeader />
            <div
               className={cn(
                  "px-4 pb-4 flex-1 overflow-y-auto bg-background rounded-b-xl",
                  showBottomNav &&
                  "overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom))]",
               )}
            >
               {children}
            </div>
            {showBottomNav && <BottomNavigation />}
            {showPWAPrompt && <PWAInstallPrompt />}
         </SidebarInset>
      </SidebarProvider>
   );
}
