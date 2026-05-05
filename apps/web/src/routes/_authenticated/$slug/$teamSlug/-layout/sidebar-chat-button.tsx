import { Badge } from "@packages/ui/components/badge";
import {
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
} from "@packages/ui/components/sidebar";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { MessageSquare } from "lucide-react";

export function SidebarChatButton() {
   return (
      <SidebarMenu>
         <SidebarMenuItem>
            <Tooltip>
               <TooltipTrigger asChild>
                  <SidebarMenuButton
                     className="cursor-not-allowed opacity-60"
                     disabled
                     size="sm"
                  >
                     <MessageSquare aria-hidden="true" />
                     <span className="flex-1">Chat</span>
                     <Badge variant="secondary">Em breve</Badge>
                  </SidebarMenuButton>
               </TooltipTrigger>
               <TooltipContent side="right">
                  Chat com Rubi — em breve
               </TooltipContent>
            </Tooltip>
         </SidebarMenuItem>
      </SidebarMenu>
   );
}
