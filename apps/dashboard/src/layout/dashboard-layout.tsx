import { SidebarInset, SidebarProvider } from "@packages/ui/components/sidebar";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { cn } from "@packages/ui/lib/utils";
import type * as React from "react";
import { useEffect } from "react";
import { PWAInstallPrompt } from "@/default/pwa-install-prompt";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useBillReminderCheck } from "@/hooks/use-bill-reminder-check";
import { useLastOrganization } from "@/hooks/use-last-organization";
import { useIsStandalone } from "@/hooks/use-standalone";
import { AppSidebar } from "./app-sidebar";
import { BottomNavigation } from "./bottom-navigation";
import { SiteHeader } from "./site-header";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
   const isMobile = useIsMobile();
   const isStandalone = useIsStandalone();
   const showBottomNav = isMobile && isStandalone;
   const showPWAPrompt = isMobile && !isStandalone;

   const { activeOrganization } = useActiveOrganization();
   const { setLastSlug } = useLastOrganization();

   useBillReminderCheck();

   useEffect(() => {
      if (activeOrganization?.slug) {
         setLastSlug(activeOrganization.slug);
      }
   }, [activeOrganization?.slug, setLastSlug]);

   return (
      <SidebarProvider defaultOpen={false}>
         {!showBottomNav && <AppSidebar variant="inset" />}
         <SidebarInset className="h-[98vh] overflow-y-auto overflow-x-hidden">
            <SiteHeader />
            <div
               className={cn(
                  "p-4 flex-1",
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
