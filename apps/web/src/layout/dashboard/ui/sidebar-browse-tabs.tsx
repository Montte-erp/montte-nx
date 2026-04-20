import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { BotMessageSquare, LayoutGrid } from "lucide-react";

type BrowseTab = "navegar" | "assistente";

interface SidebarBrowseTabsProps {
   value: BrowseTab;
   onValueChange: (value: BrowseTab) => void;
}

export function SidebarBrowseTabs({
   value,
   onValueChange,
}: SidebarBrowseTabsProps) {
   return (
      <Tabs value={value} onValueChange={(v) => onValueChange(v as BrowseTab)}>
         <TabsList className="w-full">
            <TabsTrigger className="flex-1 gap-1.5" value="navegar">
               <LayoutGrid className="size-4" />
               Navegar
            </TabsTrigger>
            <TabsTrigger className="flex-1 gap-1.5" value="assistente">
               <BotMessageSquare className="size-4" />
               Assistente
            </TabsTrigger>
         </TabsList>
      </Tabs>
   );
}
