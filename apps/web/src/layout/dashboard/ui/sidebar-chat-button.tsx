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
                     <MessageSquare className="size-4" />
                     <span>Chat</span>
                     <span className="ml-auto rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Em breve
                     </span>
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
