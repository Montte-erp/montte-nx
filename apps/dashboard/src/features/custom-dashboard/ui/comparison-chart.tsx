import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { formatDecimalCurrency } from "@packages/money";
import { Card, CardContent } from "@packages/ui/components/card";
import {
   type ChartConfig,
   ChartContainer,
   ChartLegend,
   ChartLegendContent,
   ChartTooltip,
   ChartTooltipContent,
} from "@packages/ui/components/chart";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
   ArrowDown,
   ArrowUp,
   Minus,
   TrendingDown,
   TrendingUp,
} from "lucide-react";
import {
   Bar,
   BarChart,
   CartesianGrid,
   Cell,
   XAxis,
   YAxis,
} from "recharts";
import { useTRPC } from "@/integrations/clients";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";

type ComparisonChartProps = {
   config: InsightConfig;
   globalFilters?: {
      dateRange?: {
         startDate: string;
         endDate: string;
      };
   };
   onDrillDown?: (context: DrillDownContext) => void;
};

export function ComparisonChart({
   config,
   globalFilters,
   onDrillDown,
}: ComparisonChartProps) {
   const trpc = useTRPC();

   // Query current period
   const { data, isLoading, error } = useQuery(
      trpc.dashboards.queryInsight.queryOptions({
         config: {
            ...config,
            comparison: config.comparison || { type: "previous_period" },
         },
         globalFilters,
      }),
   );

   if (isLoading) {
      return <ComparisonSkeleton />;
   }

   if (error) {
      return (
         <div className="h-full flex items-center justify-center text-destructive text-sm">
            Falha ao carregar dados de comparação
         </div>
      );
   }

   if (!data) {
      return (
         <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado de comparação disponível
         </div>
      );
   }

   const currentValue = data.value;
   const previousValue = data.comparison?.previousValue ?? 0;
   const change = data.comparison?.change ?? 0;
   const changePercent = data.comparison?.changePercent ?? 0;
   const isPositive = change >= 0;
   const comparisonLabel =
      config.comparison?.type === "previous_year"
         ? "Last Year"
         : "Previous Period";

   // Prepare chart data for side-by-side comparison
   const chartData = [
      {
         name: "Current Period",
         value: currentValue,
      },
      {
         name: comparisonLabel,
         value: previousValue,
      },
   ];

   // If we have breakdown data, show comparison per category
   const breakdownComparison = data.breakdown?.map((item) => ({
      name: item.label,
      current: item.value,
      previous: (item as { previousValue?: number }).previousValue ?? 0,
   }));

   const chartConfig: ChartConfig = {
      current: {
         color: "hsl(var(--chart-1))",
         label: "Período Atual",
      },
      previous: {
         color: "hsl(var(--chart-2))",
         label: comparisonLabel,
      },
      value: {
         color: "hsl(var(--chart-1))",
         label: "Valor",
      },
   };

   return (
      <div className="h-full flex flex-col gap-4 overflow-auto">
         {/* Summary Cards */}
         <div className="grid grid-cols-3 gap-4 px-1">
            {/* Current Period */}
            <Card>
               <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">
                     Current Period
                  </div>
                  <div className="text-2xl font-bold">
                     {config.aggregation === "count"
                        ? currentValue.toLocaleString()
                        : formatDecimalCurrency(currentValue)}
                  </div>
               </CardContent>
            </Card>

            {/* Previous Period */}
            <Card>
               <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">
                     {comparisonLabel}
                  </div>
                  <div className="text-2xl font-bold text-muted-foreground">
                     {config.aggregation === "count"
                        ? previousValue.toLocaleString()
                        : formatDecimalCurrency(previousValue)}
                  </div>
               </CardContent>
            </Card>

            {/* Change */}
            <Card
               className={cn(
                  isPositive ? "border-green-200" : "border-red-200",
               )}
            >
               <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">
                     Change
                  </div>
                  <div
                     className={cn(
                        "text-2xl font-bold flex items-center gap-2",
                        isPositive ? "text-green-600" : "text-red-600",
                     )}
                  >
                     {isPositive ? (
                        <TrendingUp className="h-5 w-5" />
                     ) : (
                        <TrendingDown className="h-5 w-5" />
                     )}
                     <span>
                        {isPositive ? "+" : ""}
                        {changePercent.toFixed(1)}%
                     </span>
                  </div>
                  <div
                     className={cn(
                        "text-xs mt-1",
                        isPositive ? "text-green-600" : "text-red-600",
                     )}
                  >
                     {isPositive ? "+" : ""}
                     {config.aggregation === "count"
                        ? change.toLocaleString()
                        : formatDecimalCurrency(change)}
                  </div>
               </CardContent>
            </Card>
         </div>

         {/* Comparison Bar Chart */}
         <div className="flex-1 min-h-48 px-1">
            <ChartContainer className="h-full w-full" config={chartConfig}>
               {breakdownComparison && breakdownComparison.length > 0 ? (
                  <BarChart
                     accessibilityLayer
                     data={breakdownComparison.slice(0, 10)}
                     margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                     <CartesianGrid className="stroke-muted" strokeDasharray="3 3" vertical={false} />
                     <XAxis axisLine={false} dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                     <YAxis
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) =>
                           config.aggregation === "count"
                              ? value.toLocaleString()
                              : formatDecimalCurrency(value)
                        }
                        tickLine={false}
                     />
                     <ChartTooltip
                        content={
                           <ChartTooltipContent
                              formatter={(value) =>
                                 config.aggregation === "count"
                                    ? (value as number).toLocaleString()
                                    : formatDecimalCurrency(value as number)
                              }
                           />
                        }
                     />
                     <ChartLegend content={<ChartLegendContent />} />
                     <Bar
                        dataKey="current"
                        fill="var(--color-current)"
                        name="Current Period"
                        radius={[4, 4, 0, 0]}
                     />
                     <Bar
                        dataKey="previous"
                        fill="var(--color-previous)"
                        name={comparisonLabel}
                        radius={[4, 4, 0, 0]}
                     />
                  </BarChart>
               ) : (
                  <BarChart
                     accessibilityLayer
                     data={chartData}
                     margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                     <CartesianGrid className="stroke-muted" strokeDasharray="3 3" vertical={false} />
                     <XAxis axisLine={false} dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                     <YAxis
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) =>
                           config.aggregation === "count"
                              ? value.toLocaleString()
                              : formatDecimalCurrency(value)
                        }
                        tickLine={false}
                     />
                     <ChartTooltip
                        content={
                           <ChartTooltipContent
                              formatter={(value) =>
                                 config.aggregation === "count"
                                    ? (value as number).toLocaleString()
                                    : formatDecimalCurrency(value as number)
                              }
                           />
                        }
                     />
                     <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, index) => (
                           <Cell
                              fill={index === 0 ? "var(--color-current)" : "var(--color-previous)"}
                              key={`cell-${index + 1}`}
                           />
                        ))}
                     </Bar>
                  </BarChart>
               )}
            </ChartContainer>
         </div>

         {/* Breakdown List (if available) */}
         {breakdownComparison && breakdownComparison.length > 0 && (
            <div className="space-y-2 px-1">
               <div className="text-sm font-medium text-muted-foreground">
                  Breakdown by Category
               </div>
               {breakdownComparison.slice(0, 5).map((item, index) => {
                  const itemChange =
                     item.previous > 0
                        ? ((item.current - item.previous) / item.previous) * 100
                        : 0;
                  const isItemPositive = itemChange >= 0;

                  return (
                     <div
                        className={cn(
                           "flex items-center justify-between p-3 rounded-lg border",
                           onDrillDown && "cursor-pointer hover:bg-muted/50",
                        )}
                        key={`breakdown-${index + 1}`}
                        onClick={() => {
                           if (onDrillDown) {
                              onDrillDown({
                                 dimension: "categoryId",
                                 value: item.name,
                                 label: item.name,
                              });
                           }
                        }}
                        onKeyDown={(e) => {
                           if (e.key === "Enter" && onDrillDown) {
                              onDrillDown({
                                 dimension: "categoryId",
                                 value: item.name,
                                 label: item.name,
                              });
                           }
                        }}
                        role={onDrillDown ? "button" : undefined}
                        tabIndex={onDrillDown ? 0 : undefined}
                     >
                        <div>
                           <div className="font-medium">{item.name}</div>
                           <div className="text-xs text-muted-foreground">
                              {formatDecimalCurrency(item.current)} vs{" "}
                              {formatDecimalCurrency(item.previous)}
                           </div>
                        </div>
                        <div
                           className={cn(
                              "flex items-center gap-1 text-sm font-medium",
                              isItemPositive
                                 ? "text-green-600"
                                 : "text-red-600",
                           )}
                        >
                           {isItemPositive ? (
                              <ArrowUp className="h-4 w-4" />
                           ) : (
                              <ArrowDown className="h-4 w-4" />
                           )}
                           {itemChange === 0 ? (
                              <Minus className="h-4 w-4" />
                           ) : (
                              <span>
                                 {isItemPositive ? "+" : ""}
                                 {itemChange.toFixed(1)}%
                              </span>
                           )}
                        </div>
                     </div>
                  );
               })}
            </div>
         )}
      </div>
   );
}

function ComparisonSkeleton() {
   return (
      <div className="h-full flex flex-col gap-4">
         <div className="grid grid-cols-3 gap-4 px-1">
            {Array.from({ length: 3 }).map((_, i) => (
               <Skeleton className="h-24" key={`card-skeleton-${i + 1}`} />
            ))}
         </div>
         <Skeleton className="flex-1 min-h-48" />
      </div>
   );
}
