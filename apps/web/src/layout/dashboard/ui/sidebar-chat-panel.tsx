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
import { MessageSquare, Plus, Search } from "lucide-react";

export function SidebarChatPanel() {
   const { setOpen } = useSidebar();

   return (
      <>
         {/* Collapsed view */}
         <SidebarGroup className="group-data-[collapsible=icon]:block hidden">
            <SidebarMenu>
               <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Novo chat">
                     <Button
                        size="icon"
                        variant="default"
                        onClick={() => setOpen(true)}
                     >
                        <Plus />
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

         {/* Expanded view */}
         <div className="flex flex-col gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
               <InputGroup className="flex-1">
                  <InputGroupAddon>
                     <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                     aria-readonly="true"
                     placeholder="Histórico de chats"
                     readOnly
                  />
               </InputGroup>
               <Button
                  aria-label="Novo chat"
                  className="shrink-0"
                  size="icon"
                  variant="default"
               >
                  <Plus />
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
