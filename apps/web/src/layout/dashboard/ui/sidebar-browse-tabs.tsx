import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { LayoutGrid, MessageSquare } from "lucide-react";

export function SidebarBrowseTabs() {
   return (
      <Tabs defaultValue="navegar">
         <TabsList className="w-full">
            <TabsTrigger className="flex-1 gap-1.5" value="navegar">
               <LayoutGrid className="size-4" />
               Navegar
            </TabsTrigger>
            <TabsTrigger
               className="flex-1 cursor-not-allowed gap-1.5 opacity-60"
               disabled
               value="assistente"
            >
               <MessageSquare className="size-4 text-rose-400" />
               Assistente
            </TabsTrigger>
         </TabsList>
      </Tabs>
   );
}
