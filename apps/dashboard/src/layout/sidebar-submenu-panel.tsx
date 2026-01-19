import { cn } from "@packages/ui/lib/utils";
import { useEffect, useRef } from "react";
import { useSidebar } from "@packages/ui/components/sidebar";
import { useSubmenu } from "./sidebar-submenu-context";
import { SidebarReportsPanel } from "./sidebar-reports-panel";
import { SidebarPlanningPanel } from "./sidebar-planning-panel";
import { SidebarCategorizationPanel } from "./sidebar-categorization-panel";

export function SidebarSubmenuPanel() {
   const { activeSubmenu, submenuConfig, closeSubmenu } = useSubmenu();
   const { state: sidebarState } = useSidebar();
   const panelRef = useRef<HTMLDivElement>(null);

   // Close on escape key
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === "Escape" && activeSubmenu) {
            closeSubmenu();
         }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
   }, [activeSubmenu, closeSubmenu]);

   const isOpen = activeSubmenu !== null && submenuConfig !== null;
   const isCollapsed = sidebarState === "collapsed";

   // Calculate position - panel appears flush with sidebar edge
   // Use CSS variable values: --sidebar-width: 16rem (256px), --sidebar-width-icon: 3rem (48px)
   const sidebarWidth = isCollapsed ? "var(--sidebar-width-icon)" : "var(--sidebar-width)";

   // Render dynamic content based on activeSubmenu
   const renderPanelContent = () => {
      if (!submenuConfig) return null;

      switch (activeSubmenu) {
         case "reports":
            return <SidebarReportsPanel />;
         case "planning":
            return <SidebarPlanningPanel />;
         case "categorization":
            return <SidebarCategorizationPanel />;
         default:
            return null;
      }
   };

   return (
      <>
         {/* Overlay backdrop */}
         {isOpen && (
            <div
               className="fixed inset-0 z-10 bg-black/20"
               onClick={closeSubmenu}
               aria-hidden="true"
            />
         )}

         {/* Panel */}
         <div
            ref={panelRef}
            className={cn(
               "fixed top-0 bottom-0 z-20 w-[280px] bg-sidebar border-l border-sidebar-border",
               "transition-opacity duration-150 ease-out",
               isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
            style={{
               left: sidebarWidth,
            }}
         >
            {renderPanelContent()}
         </div>
      </>
   );
}
