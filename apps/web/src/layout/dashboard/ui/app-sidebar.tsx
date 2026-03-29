import { Separator } from "@packages/ui/components/separator";
import {
   Sidebar,
   SidebarContent,
   SidebarFooter,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   useSidebar,
} from "@packages/ui/components/sidebar";
import { Link, useParams } from "@tanstack/react-router";
import { MessageSquarePlus, PanelLeftClose, Settings } from "lucide-react";
import type * as React from "react";
import { POSTHOG_SURVEYS } from "@core/posthog/config";
import posthog, { DisplaySurveyType } from "posthog-js";
import { EarlyAccessSidebarBanner } from "./early-access-sidebar-banner";
import { SidebarDefaultItems, SidebarNav } from "./sidebar-nav";
import { SidebarScopeSwitcher } from "./sidebar-scope-switcher";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
   return (
      <Sidebar className="px-0" collapsible="icon" variant="inset" {...props}>
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
            <SidebarFooterContent />
            <SidebarScopeSwitcher />
         </SidebarFooter>
      </Sidebar>
   );
}


function SidebarFeedbackButton() {
   return (
      <SidebarMenuItem>
         <SidebarMenuButton
            onClick={() =>
               posthog.displaySurvey(POSTHOG_SURVEYS.featureRequest.id, {
                  displayType: DisplaySurveyType.Popover,
                  ignoreConditions: true,
                  ignoreDelay: true,
               })
            }
            tooltip="Feedback"
         >
            <MessageSquarePlus className="size-4" />
            <span>Feedback</span>
         </SidebarMenuButton>
      </SidebarMenuItem>
   );
}

function SidebarFooterContent() {
   const params = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });
   const slug = params.slug ?? "";
   const teamSlug = params.teamSlug ?? "";
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
            <SidebarMenuButton asChild tooltip="Configuracoes">
               <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/settings">
                  <Settings />
                  <span>Configuracoes</span>
               </Link>
            </SidebarMenuButton>
         </SidebarMenuItem>
         <SidebarFeedbackButton />
      </SidebarMenu>
   );
}
