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
            <TabsTrigger className="flex-1 gap-2" value="navegar">
               <LayoutGrid aria-hidden="true" />
               Navegar
            </TabsTrigger>
            <TabsTrigger className="flex-1 gap-2" value="assistente">
               <BotMessageSquare aria-hidden="true" />
               Assistente
            </TabsTrigger>
         </TabsList>
      </Tabs>
   );
}
