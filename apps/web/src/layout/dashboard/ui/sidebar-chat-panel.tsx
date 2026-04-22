import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
} from "@packages/ui/components/empty";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import {
   SidebarGroup,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   useSidebar,
} from "@packages/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import { MessageSquare, Plus, Search } from "lucide-react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";

export function SidebarChatPanel() {
   const { setOpen } = useSidebar();
   const { slug, teamSlug } = useDashboardSlugs();

   return (
      <>
         <SidebarGroup className="group-data-[collapsible=icon]:block hidden">
            <SidebarMenu>
               <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Novo chat">
                     <Button asChild size="icon" variant="default">
                        <Link
                           params={{ slug, teamSlug }}
                           search={(prev) => prev}
                           to="/$slug/$teamSlug/chat"
                        >
                           <Plus />
                        </Link>
                     </Button>
                  </SidebarMenuButton>
               </SidebarMenuItem>
               <SidebarMenuItem>
                  <SidebarMenuButton
                     tooltip="Histórico de chats"
                     onClick={() => setOpen(true)}
                  >
                     <Search />
                     <span>Histórico de chats</span>
                  </SidebarMenuButton>
               </SidebarMenuItem>
            </SidebarMenu>
         </SidebarGroup>

         <div className="flex flex-col gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
               <InputGroup className="flex-1">
                  <InputGroupAddon>
                     <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                     aria-label="Pesquisar histórico de chats"
                     aria-readonly="true"
                     placeholder="Histórico de chats"
                     readOnly
                  />
               </InputGroup>
               <Button
                  aria-label="Novo chat"
                  asChild
                  className="shrink-0"
                  size="icon"
                  variant="default"
               >
                  <Link
                     params={{ slug, teamSlug }}
                     search={(prev) => prev}
                     to="/$slug/$teamSlug/chat"
                  >
                     <Plus />
                  </Link>
               </Button>
            </div>
            <Empty className="border py-4">
               <EmptyMedia>
                  <MessageSquare className="text-muted-foreground/50" />
               </EmptyMedia>
               <EmptyHeader>
                  <EmptyDescription>Nenhum chat encontrado</EmptyDescription>
               </EmptyHeader>
            </Empty>
         </div>
      </>
   );
}
