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
import { PanelLeftClose, Settings } from "lucide-react";
import type * as React from "react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { EarlyAccessSidebarBanner } from "./early-access-sidebar-banner";
import { SidebarDefaultItems, SidebarNav } from "./sidebar-nav";
import { SidebarScopeSwitcher } from "./sidebar-scope-switcher";
import { SidebarChatButton } from "./sidebar-chat-button";
import { SidebarAccountMenu } from "./sidebar-account-menu";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
   return (
      <Sidebar className="px-0" collapsible="icon" variant="inset" {...props}>
         <SidebarHeader className="gap-1 pb-2">
            <SidebarChatButton />
         </SidebarHeader>

         <SidebarContent>
            <SidebarDefaultItems />
            <div className="px-2">
               <Separator />
            </div>
            <SidebarNav />
         </SidebarContent>

         <SidebarFooter>
            <EarlyAccessSidebarBanner />
            <Separator />
            <SidebarAccountMenu />
            <Separator />
            <SidebarFooterContent />
            <Separator />
            <SidebarScopeSwitcher />
         </SidebarFooter>
      </Sidebar>
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
