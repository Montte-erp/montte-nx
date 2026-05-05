import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { BotMessageSquare, LayoutGrid } from "lucide-react";
import { motion } from "motion/react";

interface SidebarBrowseTabsProps {
   value: "navegar" | "assistente";
   onValueChange: (value: "navegar" | "assistente") => void;
}

export function SidebarBrowseTabs({
   value,
   onValueChange,
}: SidebarBrowseTabsProps) {
   return (
      <Tabs
         value={value}
         onValueChange={(v) => onValueChange(v as "navegar" | "assistente")}
      >
         <TabsList className="w-full">
            <TabTriggerWithIndicator
               active={value === "navegar"}
               value="navegar"
            >
               <LayoutGrid aria-hidden="true" />
               Navegar
            </TabTriggerWithIndicator>
            <TabTriggerWithIndicator
               active={value === "assistente"}
               value="assistente"
            >
               <BotMessageSquare aria-hidden="true" />
               Assistente
            </TabTriggerWithIndicator>
         </TabsList>
      </Tabs>
   );
}

function TabTriggerWithIndicator({
   active,
   value,
   children,
}: {
   active: boolean;
   value: string;
   children: React.ReactNode;
}) {
   return (
      <TabsTrigger
         className="relative flex-1 gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
         value={value}
      >
         {active && (
            <motion.div
               className="absolute inset-0 -z-0 rounded-md bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
               layoutId="sidebar-browse-tab-indicator"
               transition={{ type: "spring", stiffness: 700, damping: 38 }}
            />
         )}
         <span className="relative z-10 flex items-center gap-2">
            {children}
         </span>
      </TabsTrigger>
   );
}
