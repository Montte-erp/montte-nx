import { Badge } from "@packages/ui/components/badge";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
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

type InsightConfigMobileNavProps = {
   activeSection: ConfigSection;
   onSectionChange: (section: ConfigSection) => void;
   activeFilterCount?: number;
};

export function InsightConfigMobileNav({
   activeSection,
   onSectionChange,
   activeFilterCount = 0,
}: InsightConfigMobileNavProps) {
   const currentItem = NAVIGATION_ITEMS.find(
      (item) => item.id === activeSection,
   );
   const CurrentIcon = currentItem?.icon || LineChart;

   return (
      <div className="px-4 pb-3 md:hidden">
         <Select
            onValueChange={(value) => onSectionChange(value as ConfigSection)}
            value={activeSection}
         >
            <SelectTrigger className="w-full h-11">
               <SelectValue>
                  <span className="flex items-center gap-2">
                     <CurrentIcon className="h-4 w-4" />
                     {currentItem?.label}
                     {activeSection === "data-filters" &&
                        activeFilterCount > 0 && (
                           <Badge
                              className="h-5 min-w-5 px-1.5 text-xs ml-auto"
                              variant="secondary"
                           >
                              {activeFilterCount}
                           </Badge>
                        )}
                  </span>
               </SelectValue>
            </SelectTrigger>
            <SelectContent>
               {NAVIGATION_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const showBadge =
                     item.id === "data-filters" && activeFilterCount > 0;

                  return (
                     <SelectItem
                        className="py-3"
                        key={item.id}
                        value={item.id}
                     >
                        <span className="flex items-center gap-2 w-full">
                           <Icon className="h-4 w-4" />
                           <span>{item.label}</span>
                           {showBadge && (
                              <Badge
                                 className="h-5 min-w-5 px-1.5 text-xs ml-auto"
                                 variant="secondary"
                              >
                                 {activeFilterCount}
                              </Badge>
                           )}
                        </span>
                     </SelectItem>
                  );
               })}
            </SelectContent>
         </Select>
      </div>
   );
}
