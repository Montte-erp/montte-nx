import { Input } from "@packages/ui/components/input";
import {
   SidebarManager,
   SidebarProvider,
   useSidebar,
   useSidebarManager,
} from "@packages/ui/components/sidebar";
import { Search, X } from "lucide-react";
import {
   type SubSidebarSection,
   setActiveSection,
   setSearchQuery,
   useActiveSection,
   useSearchQuery,
} from "./hooks/use-sidebar-store";
import { SubSidebarItemList } from "./sub-sidebar-item-list";
import { SubSidebarNewMenu } from "./sub-sidebar-new-menu";

const SECTION_TITLES: Record<SubSidebarSection, string> = {
   dashboards: "Dashboards",
   insights: "Insights",
};

export function SidebarSubPanel() {
   const activeSection = useActiveSection();

   return (
      <SidebarProvider
         className="min-h-0"
         onOpenChange={(open) => {
            if (!open) setActiveSection(null);
         }}
         open={activeSection !== null}
      >
         <SidebarManager name="sub-panel">
            <SubPanelSidebar activeSection={activeSection} />
         </SidebarManager>
      </SidebarProvider>
   );
}

function SubPanelSidebar({
   activeSection,
}: {
   activeSection: SubSidebarSection | null;
}) {
   const { open } = useSidebar();
   const searchQuery = useSearchQuery();
   const manager = useSidebarManager();
   const mainSidebar = manager.use("main");
   const panelLeft =
      mainSidebar?.state === "collapsed"
         ? "calc(var(--sidebar-width-icon) + 1rem)"
         : "calc(var(--sidebar-width) - 1px)";

   if (!open || !activeSection) return null;

   const closePanel = () => setActiveSection(null);

   return (
      <>
         <button
            aria-label="Fechar painel"
            className="fixed inset-y-0 right-0 z-[900] bg-background/35 backdrop-blur-md backdrop-saturate-150"
            onClick={closePanel}
            style={{ left: `calc(${panelLeft} + 280px)` }}
            type="button"
         />
         <div
            className="fixed inset-y-0 z-[1000] flex w-[280px] flex-col overflow-hidden border-l border-white/10 bg-sidebar shadow-xl"
            style={{ left: panelLeft }}
         >
            <div className="flex flex-col gap-2 p-4">
               <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                     {SECTION_TITLES[activeSection]}
                  </h2>
                  <div className="flex items-center gap-2">
                     <SubSidebarNewMenu
                        onAction={closePanel}
                        section={activeSection}
                     />
                     <button
                        aria-label="Fechar painel"
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        onClick={closePanel}
                        type="button"
                     >
                        <X className="size-4" />
                     </button>
                  </div>
               </div>
               <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
                  <Input
                     className="h-8 pl-8 text-sm"
                     onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder="Buscar..."
                     value={searchQuery}
                  />
               </div>
            </div>
            <div className="flex-1 overflow-y-auto">
               <SubSidebarItemList
                  onItemClick={closePanel}
                  searchQuery={searchQuery}
                  section={activeSection}
               />
            </div>
         </div>
      </>
   );
}
