import { Badge } from "@packages/ui/components/badge";
import {
   Sidebar,
   SidebarContent,
   SidebarGroup,
   SidebarGroupContent,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
} from "@packages/ui/components/sidebar";
import { Calendar, Eye, Filter, LineChart, Sparkles } from "lucide-react";
import type { ConfigSection } from "./config-search-index";

const NAVIGATION_ITEMS: Array<{
   id: ConfigSection;
   label: string;
   icon: typeof LineChart;
}> = [
   { id: "display-type", label: "Tipo de Exibicao", icon: LineChart },
   { id: "time-filters", label: "Periodo", icon: Calendar },
   { id: "data-filters", label: "Filtros de Dados", icon: Filter },
   { id: "chart-options", label: "Opcoes do Grafico", icon: Eye },
   { id: "advanced", label: "Avancado", icon: Sparkles },
];

type InsightConfigSidebarProps = {
   activeSection: ConfigSection;
   onSectionChange: (section: ConfigSection) => void;
   activeFilterCount?: number;
};

export function InsightConfigSidebar({
   activeSection,
   onSectionChange,
   activeFilterCount = 0,
}: InsightConfigSidebarProps) {
   return (
      <Sidebar className="hidden md:flex w-[180px] border-r" collapsible="none">
         <SidebarContent>
            <SidebarGroup>
               <SidebarGroupContent>
                  <SidebarMenu>
                     {NAVIGATION_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeSection === item.id;
                        const showBadge =
                           item.id === "data-filters" && activeFilterCount > 0;

                        return (
                           <SidebarMenuItem key={item.id}>
                              <SidebarMenuButton
                                 className="justify-between"
                                 isActive={isActive}
                                 onClick={() => onSectionChange(item.id)}
                              >
                                 <span className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    <span className="text-sm">
                                       {item.label}
                                    </span>
                                 </span>
                                 {showBadge && (
                                    <Badge
                                       className="h-5 min-w-5 px-1.5 text-xs"
                                       variant="secondary"
                                    >
                                       {activeFilterCount}
                                    </Badge>
                                 )}
                              </SidebarMenuButton>
                           </SidebarMenuItem>
                        );
                     })}
                  </SidebarMenu>
               </SidebarGroupContent>
            </SidebarGroup>
         </SidebarContent>
      </Sidebar>
   );
}
