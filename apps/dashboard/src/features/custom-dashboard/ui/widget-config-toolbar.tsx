import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import {
   Bookmark,
   Filter,
   Maximize2,
   Minimize2,
   Settings2,
   Trash2,
} from "lucide-react";
import {
   getChartTypeIcon,
   getChartTypeLabel,
} from "./insight-config-dialog/config-search-index";

type WidgetConfigToolbarProps = {
   config: InsightConfig;
   onOpenDisplayType: () => void;
   onOpenOptions: () => void;
   onOpenFilters: () => void;
   onSaveAsInsight: () => void;
   canExpand: boolean;
   canShrink: boolean;
   onExpand: () => void;
   onShrink: () => void;
   onRemove: () => void;
};

export function WidgetConfigToolbar({
   config,
   onOpenDisplayType,
   onOpenOptions,
   onOpenFilters,
   onSaveAsInsight,
   canExpand,
   canShrink,
   onExpand,
   onShrink,
   onRemove,
}: WidgetConfigToolbarProps) {
   // Count active data filters
   const activeFilterCount = config.filters?.length || 0;

   const CurrentIcon = getChartTypeIcon(config.chartType);

   return (
      <div className="flex items-center justify-end gap-0.5 p-2 border-b bg-muted/30">
         <div className="flex items-center gap-0.5">
            {/* Display Type */}
            <Tooltip>
               <TooltipTrigger asChild>
                  <Button
                     className="h-7 w-7"
                     onClick={onOpenDisplayType}
                     size="icon"
                     variant="ghost"
                  >
                     <CurrentIcon className="h-3.5 w-3.5" />
                  </Button>
               </TooltipTrigger>
               <TooltipContent>
                  {getChartTypeLabel(config.chartType)}
               </TooltipContent>
            </Tooltip>

            {/* Filters */}
            <Tooltip>
               <TooltipTrigger asChild>
                  <Button
                     className="h-7 w-7 relative"
                     onClick={onOpenFilters}
                     size="icon"
                     variant="ghost"
                  >
                     <Filter className="h-3.5 w-3.5" />
                     {activeFilterCount > 0 && (
                        <Badge
                           className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                           variant="secondary"
                        >
                           {activeFilterCount}
                        </Badge>
                     )}
                  </Button>
               </TooltipTrigger>
               <TooltipContent>Filtros</TooltipContent>
            </Tooltip>

            {/* Options */}
            <Tooltip>
               <TooltipTrigger asChild>
                  <Button
                     className="h-7 w-7"
                     onClick={onOpenOptions}
                     size="icon"
                     variant="ghost"
                  >
                     <Settings2 className="h-3.5 w-3.5" />
                  </Button>
               </TooltipTrigger>
               <TooltipContent>Opcoes</TooltipContent>
            </Tooltip>

            {/* Save as Insight */}
            <Tooltip>
               <TooltipTrigger asChild>
                  <Button
                     className="h-7 w-7"
                     onClick={onSaveAsInsight}
                     size="icon"
                     variant="ghost"
                  >
                     <Bookmark className="h-3.5 w-3.5" />
                  </Button>
               </TooltipTrigger>
               <TooltipContent>Salvar como Insight</TooltipContent>
            </Tooltip>

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* Shrink */}
            {canShrink && (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <Button
                        className="h-7 w-7"
                        onClick={onShrink}
                        size="icon"
                        variant="ghost"
                     >
                        <Minimize2 className="h-3.5 w-3.5" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reduzir</TooltipContent>
               </Tooltip>
            )}

            {/* Expand */}
            {canExpand && (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <Button
                        className="h-7 w-7"
                        onClick={onExpand}
                        size="icon"
                        variant="ghost"
                     >
                        <Maximize2 className="h-3.5 w-3.5" />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent>Expandir</TooltipContent>
               </Tooltip>
            )}

            {/* Remove */}
            <Tooltip>
               <TooltipTrigger asChild>
                  <Button
                     className="h-7 w-7 text-destructive hover:text-destructive"
                     onClick={onRemove}
                     size="icon"
                     variant="ghost"
                  >
                     <Trash2 className="h-3.5 w-3.5" />
                  </Button>
               </TooltipTrigger>
               <TooltipContent>Remover widget</TooltipContent>
            </Tooltip>
         </div>
      </div>
   );
}
