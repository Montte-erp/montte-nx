import type { InsightConfig } from "@packages/database/schemas/dashboards";
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from "@packages/ui/components/command";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { cn } from "@packages/ui/lib/utils";
import {
   AreaChart,
   BarChart3,
   Check,
   GitMerge,
   Globe,
   Grid3X3,
   Hash,
   Layers,
   LineChart,
   PieChart,
   Scale,
   Table2,
   TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { useCredenza } from "@/hooks/use-credenza";

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
      name: "Séries Temporais",
      types: [
         {
            value: "line",
            label: "Gráfico de linhas",
            description: "Tendências ao longo do tempo como uma linha contínua",
            icon: LineChart,
         },
         {
            value: "area",
            label: "Gráfico de área",
            description: "Tendências ao longo do tempo como uma área sombreada",
            icon: AreaChart,
         },
         {
            value: "bar",
            label: "Gráfico de barras",
            description:
               "Tendências ao longo do tempo como barras verticais lado a lado",
            icon: BarChart3,
         },
         {
            value: "stacked_bar",
            label: "Gráfico de barras empilhadas",
            description:
               "Tendências ao longo do tempo como barras verticais empilhadas",
            icon: Layers,
         },
      ],
   },
   {
      name: "Séries Cumulativas",
      types: [
         {
            value: "line_cumulative",
            label: "Linha (cumulativa)",
            description: "Acumulando valores ao longo do tempo",
            icon: TrendingUp,
         },
      ],
   },
   {
      name: "Valor Total",
      types: [
         {
            value: "stat_card",
            label: "Número",
            description: "Um número grande mostrando o valor total",
            icon: Hash,
         },
         {
            value: "pie",
            label: "Gráfico de pizza",
            description: "Proporções de um todo como fatias",
            icon: PieChart,
         },
         {
            value: "bar_total",
            label: "Gráfico de barras (total)",
            description: "Valores totais como barras horizontais",
            icon: BarChart3,
         },
         {
            value: "table",
            label: "Tabela",
            description: "Valores totais em uma visualização de tabela",
            icon: Table2,
         },
      ],
   },
   {
      name: "Visualizações",
      types: [
         {
            value: "world_map",
            label: "Mapa mundial",
            description: "Valores por país em um mapa",
            icon: Globe,
         },
         {
            value: "sankey",
            label: "Diagrama de Sankey",
            description: "Fluxo de receitas para despesas por categoria",
            icon: GitMerge,
         },
         {
            value: "heatmap",
            label: "Mapa de calor",
            description: "Intensidade de gastos por dia e hora",
            icon: Grid3X3,
         },
      ],
   },
   {
      name: "Análise",
      types: [
         {
            value: "category_analysis",
            label: "Análise por categoria",
            description: "Comparação entre categorias",
            icon: Layers,
         },
         {
            value: "comparison",
            label: "Comparação",
            description: "Comparar valores entre períodos",
            icon: Scale,
         },
      ],
   },
];

// Chart types available for each data source
// Bank accounts don't support time-based charts (point-in-time data)
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

type DisplayTypeCredenzaProps = {
   currentType: ChartType;
   dataSource?: DataSource;
   onSelectType: (type: ChartType) => void;
};

export function DisplayTypeCredenza({
   currentType,
   dataSource,
   onSelectType,
}: DisplayTypeCredenzaProps) {
   const { closeCredenza } = useCredenza();

   // Filter chart categories based on data source compatibility
   const filteredCategories = useMemo(() => {
      if (!dataSource) return CHART_CATEGORIES;

      const allowedTypes = CHART_TYPE_COMPATIBILITY[dataSource] || [];
      return CHART_CATEGORIES.map((category) => ({
         ...category,
         types: category.types.filter((type) =>
            allowedTypes.includes(type.value),
         ),
      })).filter((category) => category.types.length > 0);
   }, [dataSource]);

   const handleSelect = (type: ChartType) => {
      onSelectType(type);
      closeCredenza();
   };

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle className="flex items-center gap-2">
               <BarChart3 className="h-5 w-5" />
               Tipo de Exibição
            </CredenzaTitle>
            <CredenzaDescription>
               Escolha como visualizar seus dados
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="p-0">
            <Command className="rounded-none border-none">
               <div className="border-b px-3 pb-3">
                  <CommandInput
                     className="h-10"
                     placeholder="Buscar tipos de gráfico..."
                  />
               </div>
               <CommandList className="max-h-[400px] p-2">
                  <CommandEmpty>Nenhum resultado encontrado</CommandEmpty>
                  {filteredCategories.map((category) => (
                     <CommandGroup
                        className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2"
                        heading={category.name}
                        key={category.name}
                     >
                        {category.types.map((type) => {
                           const Icon = type.icon;
                           const isSelected = currentType === type.value;
                           return (
                              <CommandItem
                                 className={cn(
                                    "flex items-start gap-3 py-3 px-3 rounded-lg mb-1 cursor-pointer",
                                    "transition-all duration-150",
                                    isSelected
                                       ? "bg-primary/10 border-l-2 border-l-primary"
                                       : "border-l-2 border-l-transparent hover:bg-muted/50",
                                 )}
                                 key={type.value}
                                 onSelect={() => handleSelect(type.value)}
                                 value={`${type.label} ${type.description}`}
                              >
                                 <div
                                    className={cn(
                                       "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                                       isSelected
                                          ? "bg-primary text-primary-foreground"
                                          : "border bg-background",
                                    )}
                                 >
                                    <Icon className="h-5 w-5" />
                                 </div>
                                 <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                    <span className="font-medium">
                                       {type.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground leading-relaxed">
                                       {type.description}
                                    </span>
                                 </div>
                                 {isSelected && (
                                    <Check className="h-5 w-5 text-primary shrink-0 self-center" />
                                 )}
                              </CommandItem>
                           );
                        })}
                     </CommandGroup>
                  ))}
               </CommandList>
            </Command>
         </CredenzaBody>
      </>
   );
}
