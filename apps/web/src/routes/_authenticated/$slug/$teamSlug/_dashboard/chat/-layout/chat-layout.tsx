import { Button } from "@packages/ui/components/button";
import {
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { SearchInput } from "@packages/ui/components/search-input";
import {
   Sidebar,
   SidebarContent,
   SidebarHeader,
   SidebarInset,
   SidebarManager,
   SidebarProvider,
} from "@packages/ui/components/sidebar";
import { useForm } from "@tanstack/react-form";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useMediaQuery } from "foxact/use-media-query";
import { Menu } from "lucide-react";
import type * as React from "react";
import { useCredenza } from "@/hooks/use-credenza";
import { Route } from "@/routes/_authenticated/$slug/$teamSlug/_dashboard/chat";
import { ChatSidebar } from "./chat-sidebar";

const CHAT_SIDEBAR_STYLE = {
   "--sidebar-width": "16rem",
   "--sidebar": "var(--muted)",
   "--sidebar-foreground": "var(--muted-foreground)",
} as React.CSSProperties;

interface ChatLayoutProps {
   children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
   const isMobile = useMediaQuery("(max-width: 767px)", false);

   if (isMobile) return <ChatLayoutMobile>{children}</ChatLayoutMobile>;
   return <ChatLayoutDesktop>{children}</ChatLayoutDesktop>;
}

function ChatLayoutDesktop({ children }: ChatLayoutProps) {
   const { q } = Route.useSearch();
   return (
      <SidebarProvider
         className="!absolute !inset-0 !min-h-0 !h-full"
         style={CHAT_SIDEBAR_STYLE}
      >
         <SidebarManager name="chat">
            <Sidebar className="border-r" collapsible="none">
               <SidebarHeader className="p-4">
                  <ChatSearchField />
               </SidebarHeader>
               <SidebarContent>
                  <ChatSidebar search={q} />
               </SidebarContent>
            </Sidebar>
         </SidebarManager>
         <SidebarInset className="flex-1 overflow-hidden">
            <main className="h-full">{children}</main>
         </SidebarInset>
      </SidebarProvider>
   );
}

function ChatLayoutMobile({ children }: ChatLayoutProps) {
   const { openCredenza } = useCredenza();

   return (
      <div className="flex h-full flex-col gap-4">
         <Button
            className="w-fit gap-2"
            onClick={() =>
               openCredenza({
                  renderChildren: () => <MobileSidebarBody />,
                  className: "p-0",
               })
            }
            variant="ghost"
         >
            <Menu className="size-4" />
            Conversas
         </Button>
         <div className="flex-1 min-h-0">{children}</div>
      </div>
   );
}

function MobileSidebarBody() {
   const { q } = Route.useSearch();
   return (
      <>
         <CredenzaHeader className="p-4">
            <CredenzaTitle>Conversas</CredenzaTitle>
            <ChatSearchField />
         </CredenzaHeader>
         <div className="overflow-y-auto px-2 pb-4">
            <ChatSidebar search={q} />
         </div>
      </>
   );
}

function ChatSearchField() {
   const { q } = Route.useSearch();
   const navigate = Route.useNavigate();

   const debouncedNavigate = useDebouncedCallback(
      (value: string) =>
         navigate({
            search: (prev) => ({ ...prev, q: value }),
            replace: true,
         }),
      { wait: 300 },
   );

   const form = useForm({ defaultValues: { q } });

   return (
      <form.Field name="q">
         {(field) => (
            <SearchInput
               aria-label="Buscar conversas"
               id={field.name}
               name={field.name}
               onChange={(e) => {
                  field.handleChange(e.target.value);
                  debouncedNavigate(e.target.value);
               }}
               placeholder="Buscar conversas..."
               value={field.state.value}
            />
         )}
      </form.Field>
   );
}
