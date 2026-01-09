import { SidebarInset, SidebarProvider } from "@packages/ui/components/sidebar";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { cn } from "@packages/ui/lib/utils";
import type * as React from "react";
import { useEffect, useMemo } from "react";
import { PWAInstallPrompt } from "@/default/pwa-install-prompt";
import { useDashboardTabs } from "@/features/dashboard/hooks/use-dashboard-tabs";
import { useTabRouteSync } from "@/features/dashboard/hooks/use-tab-route-sync";
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
   const { tabs, activeTabId } = useDashboardTabs();

   // Sync active tab with current route
   useTabRouteSync();

   useBillReminderCheck();

   useEffect(() => {
      if (activeOrganization?.slug) {
         setLastSlug(activeOrganization.slug);
      }
   }, [activeOrganization?.slug, setLastSlug]);

   // Calculate active tab index for border radius logic
   // Sort tabs the same way as tab bar: app first, then pinned, then unpinned
   const activeTabIndex = useMemo(() => {
      const appTab = tabs.find((t) => t.type === "app");
      const pinnedTabs = tabs.filter(
         (t) => t.type !== "app" && "isPinned" in t && t.isPinned,
      );
      const unpinnedTabs = tabs.filter(
         (t) => t.type !== "app" && !("isPinned" in t && t.isPinned),
      );
      const sortedTabs = [appTab, ...pinnedTabs, ...unpinnedTabs].filter(Boolean);
      return sortedTabs.findIndex((t) => t?.id === activeTabId);
   }, [tabs, activeTabId]);

   return (
      <SidebarProvider defaultOpen={false}>
         {!showBottomNav && <AppSidebar variant="inset" />}
         <SidebarInset className="h-[98vh] overflow-y-auto overflow-x-hidden">
            <SiteHeader />
            <div
               className={cn(
                  "p-4 flex-1 bg-background rounded-b-xl",
                  // Tab panel effect: when first tab is active, no top-left radius
                  // When other tabs are active, add top-left radius
                  activeTabIndex === 0 ? "rounded-tr-xl" : "rounded-t-xl",
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
