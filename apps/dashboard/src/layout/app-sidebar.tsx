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
import { Link, useParams } from "@tanstack/react-router";
import { PanelLeft } from "lucide-react";
import type * as React from "react";
import { NavNotifications } from "@/features/notifications/ui/nav-notifications";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { OrganizationSwitcher } from "./organization-switcher";
import { SubmenuProvider } from "./sidebar-submenu-context";
import { SidebarSubmenuPanel } from "./sidebar-submenu-panel";

function MontteBranding() {
   const { slug } = useParams({ strict: false }) as { slug: string };

   return (
      <SidebarMenu>
         <SidebarMenuItem>
            <SidebarMenuButton
               asChild
               className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
               size="lg"
            >
               <Link params={{ slug }} to="/$slug/home">
                  <div className="flex aspect-square size-8 items-center justify-center">
                     <svg
                        className="size-full"
                        fill="none"
                        viewBox="0 0 1987 1278"
                     >
                        <title>Montte Logo</title>
                        <path
                           d="M455.313 377.152L0.812988 1275.15L904.813 1276.15L455.313 377.152Z"
                           fill="#0C5343"
                        />
                        <path
                           d="M1613.81 1276.15L995.313 1276.65L681.813 656.152L682.313 655.152L994.313 1.15186L1614.81 1276.15H1613.81Z"
                           fill="#42B46E"
                        />
                        <path
                           d="M1394.81 655.152L1533.31 376.652L1985.8 1276.15H1701.81L1394.81 655.152Z"
                           fill="#379255"
                        />
                     </svg>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                     <span className="truncate font-semibold">Montte</span>
                  </div>
               </Link>
            </SidebarMenuButton>
         </SidebarMenuItem>
      </SidebarMenu>
   );
}

function SidebarCollapseButton() {
   const { toggleSidebar, state } = useSidebar();

   const tooltipText = state === "expanded" ? "Ocultar" : "Abrir";

   return (
      <SidebarMenu>
         <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleSidebar} tooltip={tooltipText}>
               <PanelLeft />
               <span>{tooltipText}</span>
            </SidebarMenuButton>
         </SidebarMenuItem>
      </SidebarMenu>
   );
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
   const { activeSubscription } = useActiveOrganization();

   const hasOrgSwitcher =
      (activeSubscription?.plan?.toLowerCase() === "pro" ||
         activeSubscription?.plan?.toLowerCase() === "erp") &&
      (activeSubscription?.status === "active" ||
         activeSubscription?.status === "trialing");

   return (
      <SubmenuProvider>
         <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
               {hasOrgSwitcher ? <OrganizationSwitcher /> : <MontteBranding />}
            </SidebarHeader>
            <SidebarContent>
               <Separator />
               <NavMain />
            </SidebarContent>
            <SidebarFooter>
               <Separator />
               <SidebarCollapseButton />
               <NavNotifications />
               <NavUser />
            </SidebarFooter>
         </Sidebar>
         <SidebarSubmenuPanel />
      </SubmenuProvider>
   );
}
