import { Button } from "@packages/ui/components/button";
import {
   SheetDescription,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import {
   Sidebar,
   SidebarContent,
   SidebarHeader,
   SidebarInset,
   SidebarManager,
   SidebarProvider,
} from "@packages/ui/components/sidebar";
import { useMediaQuery } from "foxact/use-media-query";
import { Menu } from "lucide-react";
import type * as React from "react";
import { useSheet } from "@/hooks/use-sheet";
import { RouteTransition } from "@/components/route-transition";
import { ThreadList } from "../../../-montte-ai/thread-list";

const CHAT_SIDEBAR_STYLE = {
   "--sidebar-width": "16rem",
   "--sidebar": "var(--muted)",
   "--sidebar-foreground": "var(--text-foreground)",
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
   return (
      <SidebarProvider
         className="!absolute !inset-0 !min-h-0 !h-full"
         style={CHAT_SIDEBAR_STYLE}
      >
         <SidebarManager name="chat">
            <Sidebar className="border-r" collapsible="none">
               <SidebarHeader className="p-4 pb-2">
                  <span className="text-sm font-medium">Conversas</span>
               </SidebarHeader>
               <SidebarContent>
                  <ThreadList />
               </SidebarContent>
            </Sidebar>
         </SidebarManager>
         <SidebarInset className="flex-1 overflow-hidden">
            <main className="flex h-full px-4 py-2">
               <div className="self-center flex h-full w-full max-w-5xl">
                  <RouteTransition>{children}</RouteTransition>
               </div>
            </main>
         </SidebarInset>
      </SidebarProvider>
   );
}

function ChatLayoutMobile({ children }: ChatLayoutProps) {
   const { openSheet } = useSheet();

   return (
      <div className="flex h-full flex-col gap-4">
         <Button
            className="w-fit gap-2"
            onClick={() =>
               openSheet({
                  renderChildren: () => <MobileSidebarBody />,
                  className: "w-80 sm:max-w-80 p-0",
                  side: "left",
               })
            }
            variant="ghost"
         >
            <Menu className="size-4" />
            Conversas
         </Button>
         <div className="flex-1 min-h-0">
            <RouteTransition>{children}</RouteTransition>
         </div>
      </div>
   );
}

function MobileSidebarBody() {
   return (
      <SidebarProvider
         className="flex h-full min-h-0 flex-col"
         style={CHAT_SIDEBAR_STYLE}
      >
         <SheetHeader className="gap-2 p-4">
            <SheetTitle>Conversas</SheetTitle>
            <SheetDescription>
               Histórico de conversas com a Montte AI.
            </SheetDescription>
         </SheetHeader>
         <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
            <ThreadList />
         </div>
      </SidebarProvider>
   );
}
