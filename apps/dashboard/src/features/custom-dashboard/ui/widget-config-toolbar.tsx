import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";
import {
   AreaChart,
   BarChart3,
   Bookmark,
   Check,
   Filter,
   GitMerge,
   Globe,
   Grid3X3,
   Hash,
   Layers,
   LineChart,
   Maximize2,
   Minimize2,
   PieChart,
   Scale,
   Settings2,
   Table2,
   Trash2,
   TrendingUp,
} from "lucide-react";
import { useMemo } from "react";

type ChartType = InsightConfig["chartType"];
type DataSource = InsightConfig["dataSource"];

type ChartTypeOption = {
   value: ChartType;
   label: string;
   description: string;
   icon: typeof LineChart;
};

type ChartCategory = {
   name: string;
   types: ChartTypeOption[];
};

const CHART_CATEGORIES: ChartCategory[] = [
   {
      name: "Series Temporais",
      types: [
         {
            value: "line",
            label: "Grafico de linhas",
            description: "Tendencias ao longo do tempo",
            icon: LineChart,
         },
         {
            value: "area",
            label: "Grafico de area",
            description: "Area sombreada ao longo do tempo",
            icon: AreaChart,
         },
         {
            value: "bar",
            label: "Grafico de barras",
            description: "Barras verticais lado a lado",
            icon: BarChart3,
         },
         {
            value: "stacked_bar",
            label: "Barras empilhadas",
            description: "Barras verticais empilhadas",
            icon: Layers,
         },
         {
            value: "line_cumulative",
            label: "Linha cumulativa",
            description: "Valores acumulados",
            icon: TrendingUp,
         },
      ],
   },
   {
      name: "Valor Total",
      types: [
         {
            value: "stat_card",
            label: "Numero",
            description: "Valor total em destaque",
            icon: Hash,
         },
         {
            value: "pie",
            label: "Grafico de pizza",
            description: "Proporcoes como fatias",
            icon: PieChart,
         },
         {
            value: "bar_total",
            label: "Barras horizontais",
            description: "Totais como barras",
            icon: BarChart3,
         },
         {
            value: "table",
            label: "Tabela",
            description: "Dados em tabela",
            icon: Table2,
         },
      ],
   },
   {
      name: "Visualizacoes",
      types: [
         {
            value: "world_map",
            label: "Mapa mundial",
            description: "Valores por pais",
            icon: Globe,
         },
         {
            value: "sankey",
            label: "Diagrama Sankey",
            description: "Fluxo de valores",
            icon: GitMerge,
         },
         {
            value: "heatmap",
            label: "Mapa de calor",
            description: "Intensidade por periodo",
            icon: Grid3X3,
         },
      ],
   },
   {
      name: "Analise",
      types: [
         {
            value: "category_analysis",
            label: "Por categoria",
            description: "Comparacao entre categorias",
            icon: Layers,
         },
         {
            value: "comparison",
            label: "Comparacao",
            description: "Comparar periodos",
            icon: Scale,
         },
      ],
   },
];

const CHART_TYPE_COMPATIBILITY: Record<DataSource, ChartType[]> = {
   transactions: [
      "line",
      "area",
      "bar",
      "stacked_bar",
      "line_cumulative",
      "pie",
      "donut",
      "stat_card",
      "bar_total",
      "table",
      "category_analysis",
      "comparison",
      "sankey",
      "heatmap",
   ],
   bills: [
      "line",
      "area",
      "bar",
      "stacked_bar",
      "line_cumulative",
      "pie",
      "donut",
      "stat_card",
      "bar_total",
      "table",
   ],
   budgets: [
      "line",
      "area",
      "bar",
      "stacked_bar",
      "line_cumulative",
      "pie",
      "donut",
      "stat_card",
      "bar_total",
      "table",
   ],
   bank_accounts: ["pie", "donut", "bar", "stat_card", "bar_total", "table"],
};

// Get icon for current chart type
function getChartTypeIcon(chartType: ChartType) {
   for (const category of CHART_CATEGORIES) {
      const found = category.types.find((t) => t.value === chartType);
      if (found) return found.icon;
   }
   return LineChart;
}

// Get label for current chart type
function getChartTypeLabel(chartType: ChartType) {
   for (const category of CHART_CATEGORIES) {
      const found = category.types.find((t) => t.value === chartType);
      if (found) return found.label;
   }
   return "Exibicao";
}

type WidgetConfigToolbarProps = {
   config: InsightConfig;
   onUpdateConfig: (updates: Partial<InsightConfig>) => void;
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
   onUpdateConfig,
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

   // Filter chart categories based on data source compatibility
   const filteredCategories = useMemo(() => {
      const dataSource = config.dataSource;
      if (!dataSource) return CHART_CATEGORIES;

      const allowedTypes = CHART_TYPE_COMPATIBILITY[dataSource] || [];
      return CHART_CATEGORIES.map((category) => ({
         ...category,
         types: category.types.filter((type) =>
            allowedTypes.includes(type.value),
         ),
      })).filter((category) => category.types.length > 0);
   }, [config.dataSource]);

   const handleSelectChartType = (chartType: ChartType) => {
      onUpdateConfig({ chartType });
   };

   const CurrentIcon = getChartTypeIcon(config.chartType);

   return (
      <div className="hidden md:flex items-center justify-end gap-0.5 px-2 py-1 border-b bg-muted/30">
         <div className="flex items-center gap-0.5">
            {/* Display Type Dropdown */}
            <DropdownMenu>
               <Tooltip>
                  <TooltipTrigger asChild>
                     <DropdownMenuTrigger asChild>
                        <Button className="h-7 w-7" size="icon" variant="ghost">
                           <CurrentIcon className="h-3.5 w-3.5" />
                        </Button>
                     </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                     {getChartTypeLabel(config.chartType)}
                  </TooltipContent>
               </Tooltip>
               <DropdownMenuContent align="start" className="w-64">
                  {filteredCategories.map((category, categoryIndex) => (
                     <div key={category.name}>
                        {categoryIndex > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                           {category.name}
                        </DropdownMenuLabel>
                        <DropdownMenuGroup>
                           {category.types.map((type) => {
                              const Icon = type.icon;
                              const isSelected =
                                 config.chartType === type.value;
                              return (
                                 <DropdownMenuItem
                                    className={cn(
                                       "flex items-center gap-3 py-2 cursor-pointer",
                                       isSelected && "bg-accent",
                                    )}
                                    key={type.value}
                                    onClick={() =>
                                       handleSelectChartType(type.value)
                                    }
                                 >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    <div className="flex flex-col flex-1 min-w-0">
                                       <span className="text-sm font-medium">
                                          {type.label}
                                       </span>
                                       <span className="text-xs text-muted-foreground truncate">
                                          {type.description}
                                       </span>
                                    </div>
                                    {isSelected && (
                                       <Check className="h-4 w-4 text-primary shrink-0" />
                                    )}
                                 </DropdownMenuItem>
                              );
                           })}
                        </DropdownMenuGroup>
                     </div>
                  ))}
               </DropdownMenuContent>
            </DropdownMenu>

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
