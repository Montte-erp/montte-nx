import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   CredenzaBody,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Popover,
   PopoverContent,
   PopoverDescription,
   PopoverHeader,
   PopoverTitle,
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
import { Link, useParams } from "@tanstack/react-router";
import {
   Bug,
   ExternalLink,
   LayoutList,
   Lightbulb,
   MessageSquarePlus,
   PanelLeftClose,
   Settings,
} from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { BugReportForm } from "@/features/feedback/ui/bug-report-form";
import { FeatureRequestForm } from "@/features/feedback/ui/feature-request-form";
import { useCredenza } from "@/hooks/use-credenza";
import { useSidebarVisibility } from "@/layout/dashboard/hooks/use-sidebar-visibility";
import { navGroups } from "@/layout/dashboard/ui/sidebar-nav-items";
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

const DOCS_URL = "https://montte.co/docs";

function SidebarFeedbackButton() {
   const [open, setOpen] = useState(false);
   const { openCredenza, closeCredenza } = useCredenza();

   return (
      <SidebarMenuItem>
         <Popover onOpenChange={setOpen} open={open}>
            <PopoverTrigger asChild>
               <SidebarMenuButton tooltip="Feedback">
                  <MessageSquarePlus />
                  <span>Feedback</span>
               </SidebarMenuButton>
            </PopoverTrigger>
            <PopoverContent
               align="end"
               className="w-56 p-2"
               side="right"
               sideOffset={8}
            >
               <PopoverHeader className="mb-2">
                  <PopoverTitle>Feedback</PopoverTitle>
                  <PopoverDescription>
                     Reporte bugs ou sugira melhorias.
                  </PopoverDescription>
               </PopoverHeader>
               <div className="flex flex-col gap-1">
                  <Button
                     className="justify-start gap-3"
                     onClick={() => {
                        setOpen(false);
                        openCredenza({
                           children: (
                              <BugReportForm onSuccess={closeCredenza} />
                           ),
                        });
                     }}
                     variant="ghost"
                  >
                     <Bug className="size-4 text-red-500" />
                     <span>Reportar Bug</span>
                  </Button>
                  <Button
                     className="justify-start gap-3"
                     onClick={() => {
                        setOpen(false);
                        openCredenza({
                           children: (
                              <FeatureRequestForm onSuccess={closeCredenza} />
                           ),
                        });
                     }}
                     variant="ghost"
                  >
                     <Lightbulb className="size-4 text-amber-500" />
                     <span>Sugerir Feature</span>
                  </Button>
                  <Button
                     asChild
                     className="justify-start gap-3"
                     variant="ghost"
                  >
                     <a
                        href={DOCS_URL}
                        rel="noopener noreferrer"
                        target="_blank"
                     >
                        <ExternalLink className="size-4 text-blue-500" />
                        <span>Documentação</span>
                     </a>
                  </Button>
               </div>
            </PopoverContent>
         </Popover>
      </SidebarMenuItem>
   );
}

function SidebarVisibilityForm({ onClose }: { onClose: () => void }) {
   const { hiddenItems, toggleItem } = useSidebarVisibility();
   const configurableItems = navGroups
      .flatMap((g) => g.items)
      .filter((item) => item.configurable);

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Itens do menu</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody>
            <p className="text-sm text-muted-foreground mb-4">
               Escolha quais itens exibir na barra lateral.
            </p>
            <div className="flex flex-col gap-3">
               {configurableItems.map((item) => {
                  const Icon = item.icon;
                  const isHidden = hiddenItems.includes(item.id);
                  return (
                     <div
                        className="flex items-center gap-3"
                        key={item.id}
                     >
                        <Checkbox
                           checked={!isHidden}
                           id={`sidebar-item-${item.id}`}
                           onCheckedChange={() => toggleItem(item.id)}
                        />
                        {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is Radix */}
                        <label
                           className="flex items-center gap-2 text-sm cursor-pointer select-none"
                           htmlFor={`sidebar-item-${item.id}`}
                        >
                           <Icon className="size-4 text-muted-foreground" />
                           {item.label}
                        </label>
                     </div>
                  );
               })}
            </div>
            <div className="flex justify-end mt-6">
               <Button onClick={onClose} size="sm" variant="outline">
                  Fechar
               </Button>
            </div>
         </CredenzaBody>
      </>
   );
}

function SidebarVisibilityButton() {
   const { openCredenza, closeCredenza } = useCredenza();

   const handleOpen = () => {
      openCredenza({
         children: <SidebarVisibilityForm onClose={closeCredenza} />,
      });
   };

   return (
      <SidebarMenuItem>
         <SidebarMenuButton onClick={handleOpen} tooltip="Personalizar menu">
            <LayoutList />
            <span>Personalizar menu</span>
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
         <SidebarVisibilityButton />
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
