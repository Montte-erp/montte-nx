import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
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
import { Link } from "@tanstack/react-router";
import { Bug, MessageSquarePlus, PanelLeftClose, Settings, Sparkles } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { POSTHOG_SURVEYS } from "@core/posthog/config";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { useSurveyModal } from "@/hooks/use-survey-modal";
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
   const { openSurveyModal } = useSurveyModal();
   const [open, setOpen] = useState(false);

   const handleSelect = (surveyId: string) => {
      setOpen(false);
      openSurveyModal(surveyId);
   };

   return (
      <SidebarMenuItem>
         <Popover onOpenChange={setOpen} open={open}>
            <PopoverTrigger asChild>
               <SidebarMenuButton tooltip="Feedback">
                  <MessageSquarePlus className="size-4" />
                  <span>Feedback</span>
               </SidebarMenuButton>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-1" side="right">
               <Button
                  className="w-full justify-start gap-2"
                  onClick={() => handleSelect(POSTHOG_SURVEYS.featureRequest.id)}
                  variant="ghost"
               >
                  <Sparkles className="size-4" />
                  Sugestão de funcionalidade
               </Button>
               <Button
                  className="w-full justify-start gap-2"
                  onClick={() => handleSelect(POSTHOG_SURVEYS.bugReport.id)}
                  variant="ghost"
               >
                  <Bug className="size-4" />
                  Reportar bug
               </Button>
            </PopoverContent>
         </Popover>
      </SidebarMenuItem>
   );
}

function SidebarFooterContent() {
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
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
