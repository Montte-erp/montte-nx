import { Button } from "@packages/ui/components/button";
import { Separator } from "@packages/ui/components/separator";
import {
   Sidebar,
   SidebarContent,
   SidebarFooter,
   SidebarHeader,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   useSidebar,
} from "@packages/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import { PanelLeftClose, Search, Settings } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { EarlyAccessSidebarBanner } from "./early-access-sidebar-banner";
import { SidebarAccountMenu } from "./sidebar-account-menu";
import { SidebarBrowseTabs } from "./sidebar-browse-tabs";
import { SidebarChatPanel } from "./sidebar-chat-panel";
import { SidebarCommandDialog } from "./sidebar-command-dialog";
import { SidebarDefaultItems, SidebarNav } from "./sidebar-nav";
import { SidebarScopeSwitcher } from "./sidebar-scope-switcher";

type BrowseTab = "navegar" | "assistente";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
   const [activeTab, setActiveTab] = useState<BrowseTab>("navegar");
   const [commandOpen, setCommandOpen] = useState(false);

   return (
      <Sidebar className="px-0" collapsible="icon" variant="inset" {...props}>
         <SidebarCommandDialog
            open={commandOpen}
            onOpenChange={setCommandOpen}
         />
         <SidebarHeader className="gap-2 pb-2">
            <div className="flex items-center gap-1">
               <div className="min-w-0 flex-1">
                  <SidebarScopeSwitcher />
               </div>
               <SidebarHeaderActions
                  onSearchClick={() => setCommandOpen(true)}
               />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
               <SidebarBrowseTabs
                  value={activeTab}
                  onValueChange={setActiveTab}
               />
            </div>
         </SidebarHeader>

         <SidebarContent>
            {activeTab === "navegar" ? (
               <>
                  <SidebarDefaultItems />
                  <SidebarNav />
               </>
            ) : (
               <SidebarChatPanel />
            )}
         </SidebarContent>

         <SidebarFooter>
            <EarlyAccessSidebarBanner />
            <Separator />
            <SidebarFooterContent />
            <SidebarAccountMenu />
         </SidebarFooter>
      </Sidebar>
   );
}

function SidebarHeaderActions({
   onSearchClick,
}: {
   onSearchClick: () => void;
}) {
   return (
      <div className="flex shrink-0 items-center group-data-[collapsible=icon]:hidden">
         <Button
            className="size-7"
            size="icon"
            variant="outline"
            onClick={onSearchClick}
         >
            <Search className="size-3.5" />
         </Button>
      </div>
   );
}

function SidebarFooterContent() {
   const { slug, teamSlug } = useDashboardSlugs();
   const { toggleSidebar, state } = useSidebar();

   return (
      <SidebarMenu>
         <SidebarMenuItem>
            <SidebarMenuButton
               onClick={toggleSidebar}
               tooltip={state === "expanded" ? "Ocultar" : "Abrir"}
            >
               <PanelLeftClose
                  className={state === "collapsed" ? "rotate-180" : ""}
               />
               <span>Ocultar</span>
            </SidebarMenuButton>
         </SidebarMenuItem>
         <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Configurações">
               <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/settings">
                  <Settings />
                  <span>Configurações</span>
               </Link>
            </SidebarMenuButton>
         </SidebarMenuItem>
      </SidebarMenu>
   );
}
