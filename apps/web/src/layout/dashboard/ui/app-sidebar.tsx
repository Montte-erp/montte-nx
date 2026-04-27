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
import { motion } from "motion/react";
import {
   BotMessageSquare,
   Command,
   LayoutGrid,
   PanelLeftClose,
   Search,
   Settings,
} from "lucide-react";
import type * as React from "react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useSidebarTabs } from "@/layout/dashboard/hooks/use-sidebar-tabs";
import { EarlyAccessSidebarBanner } from "./early-access-sidebar-banner";
import { openKeyboardShortcuts } from "./keyboard-shortcuts-sheet";
import { SidebarAccountMenu } from "./sidebar-account-menu";
import { SidebarBrowseTabs } from "./sidebar-browse-tabs";
import { SidebarChatPanel } from "./sidebar-chat-panel";
import { useSidebarCommandDialog } from "./sidebar-command-dialog";
import { SidebarDefaultItems, SidebarNav } from "./sidebar-nav";
import { SidebarScopeSwitcher } from "./sidebar-scope-switcher";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
   const { sidebarTab, setTab } = useSidebarTabs();
   const { open: openSearch } = useSidebarCommandDialog();
   useHotkey("Mod+/", openKeyboardShortcuts);

   return (
      <Sidebar className="px-0" collapsible="icon" variant="inset" {...props}>
         <SidebarHeader className="gap-2 pb-2">
            <div className="flex items-center gap-2">
               <div className="min-w-0 flex-1">
                  <SidebarScopeSwitcher />
               </div>
               <SidebarHeaderActions onSearchClick={openSearch} />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
               <SidebarBrowseTabs value={sidebarTab} onValueChange={setTab} />
            </div>
            <div className="hidden group-data-[collapsible=icon]:flex justify-center">
               <Tooltip>
                  <TooltipTrigger asChild>
                     <Button
                        aria-label={
                           sidebarTab === "navegar"
                              ? "Modo Navegar"
                              : "Modo Assistente"
                        }
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                           setTab(
                              sidebarTab === "navegar"
                                 ? "assistente"
                                 : "navegar",
                           )
                        }
                     >
                        {sidebarTab === "navegar" ? (
                           <LayoutGrid />
                        ) : (
                           <BotMessageSquare />
                        )}
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                     {sidebarTab === "navegar" ? "Navegar" : "Assistente"}
                  </TooltipContent>
               </Tooltip>
            </div>
            <Separator />
         </SidebarHeader>

         <SidebarContent>
            <motion.div
               key={sidebarTab}
               animate={{ opacity: 1 }}
               className="flex flex-col gap-2"
               initial={{ opacity: 0 }}
               transition={{ duration: 0.12, ease: "easeOut" }}
            >
               {sidebarTab === "navegar" ? (
                  <>
                     <SidebarDefaultItems />
                     <SidebarNav />
                  </>
               ) : (
                  <SidebarChatPanel />
               )}
            </motion.div>
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
   const isMac =
      typeof navigator !== "undefined" &&
      /mac|iphone|ipad|ipod/i.test(navigator.userAgent);

   return (
      <div className="flex shrink-0 items-center group-data-[collapsible=icon]:hidden">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  aria-label="Buscar"
                  className="size-8"
                  size="icon"
                  variant="outline"
                  onClick={onSearchClick}
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
