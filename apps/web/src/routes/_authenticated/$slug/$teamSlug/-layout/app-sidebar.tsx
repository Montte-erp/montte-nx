import { Button } from "@packages/ui/components/button";
import { Kbd, KbdGroup } from "@packages/ui/components/kbd";
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
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link } from "@tanstack/react-router";
import { Command, PanelLeftClose, Search, Settings } from "lucide-react";
import type * as React from "react";
import { useSyncExternalStore } from "react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { EarlyAccessSidebarBanner } from "./early-access-sidebar-banner";
import { openKeyboardShortcuts } from "./keyboard-shortcuts-sheet";
import { SidebarAccountMenu } from "./sidebar-account-menu";
import { useSidebarCommandDialog } from "./sidebar-command-dialog";
import { SidebarNav } from "./sidebar-nav";
import { SidebarScopeSwitcher } from "./sidebar-scope-switcher";

function useIsMac() {
   return useSyncExternalStore(
      () => () => {},
      () => /mac|iphone|ipad|ipod/i.test(navigator.userAgent),
      () => false,
   );
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
   const { open: openSearch } = useSidebarCommandDialog();
   const { slug, teamSlug } = useDashboardSlugs();
   const { toggleSidebar, state } = useSidebar();
   const isMac = useIsMac();
   useHotkey("Mod+/", openKeyboardShortcuts);

   return (
      <Sidebar className="px-0" collapsible="icon" variant="inset" {...props}>
         <SidebarHeader className="gap-2 pb-2">
            <div className="flex items-center gap-2">
               <div className="min-w-0 flex-1">
                  <SidebarScopeSwitcher />
               </div>
               <div className="flex shrink-0 items-center group-data-[collapsible=icon]:hidden">
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <Button
                           aria-label="Buscar"
                           className="size-8"
                           onClick={openSearch}
                           size="icon"
                           variant="outline"
                        >
                           <Search />
                        </Button>
                     </TooltipTrigger>
                     <TooltipContent side="bottom">
                        <span className="flex items-center gap-2">
                           Busca
                           <KbdGroup>
                              <Kbd>{isMac ? <Command /> : "Ctrl"}</Kbd>
                              <Kbd>K</Kbd>
                           </KbdGroup>
                        </span>
                     </TooltipContent>
                  </Tooltip>
               </div>
            </div>
            <Separator />
         </SidebarHeader>

         <SidebarContent>
            <div className="flex flex-col gap-2">
               <SidebarNav />
            </div>
         </SidebarContent>

         <SidebarFooter>
            <EarlyAccessSidebarBanner />
            <Separator />
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
                     <Link
                        params={{ slug, teamSlug }}
                        to="/$slug/$teamSlug/settings"
                     >
                        <Settings />
                        <span>Configurações</span>
                     </Link>
                  </SidebarMenuButton>
               </SidebarMenuItem>
            </SidebarMenu>
            <SidebarAccountMenu />
         </SidebarFooter>
      </Sidebar>
   );
}
