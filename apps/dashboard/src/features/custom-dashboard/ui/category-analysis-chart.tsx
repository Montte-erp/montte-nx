import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { formatDecimalCurrency } from "@packages/money";
import { Card, CardContent } from "@packages/ui/components/card";
import {
   type ChartConfig,
   ChartContainer,
   ChartTooltip,
   ChartTooltipContent,
} from "@packages/ui/components/chart";
import { Progress } from "@packages/ui/components/progress";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
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
import { getItemColor } from "./chart-colors";

type CategoryAnalysisChartProps = {
   config: InsightConfig;
   globalFilters?: {
      dateRange?: {
         startDate: string;
         endDate: string;
      };
   };
   onDrillDown?: (context: DrillDownContext) => void;
};

export function CategoryAnalysisChart({
   config,
   globalFilters,
   onDrillDown,
}: CategoryAnalysisChartProps) {
   const trpc = useTRPC();

   const { data, isLoading, error } = useQuery(
      trpc.dashboards.queryInsight.queryOptions({
         config: {
            ...config,
            breakdown: { field: "categoryId" },
         },
         globalFilters,
      }),
   );

   if (isLoading) {
      return <CategoryAnalysisSkeleton />;
   }

   if (error) {
      return (
         <div className="h-full flex items-center justify-center text-destructive text-sm">
            Falha ao carregar dados de categoria
         </div>
      );
   }

   if (!data || !data.breakdown || data.breakdown.length === 0) {
      return (
         <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado de categoria disponível
         </div>
      );
   }

   // Transform breakdown data to category analysis format
   const categories = data.breakdown.map((item, index) => ({
      id: (item as { id?: string }).id || item.label,
      name: item.label,
      color: getItemColor(item.color, index),
      value: item.value,
   }));

   const total = categories.reduce((sum, cat) => sum + cat.value, 0);

   const handleCategoryClick = (category: { id: string; name: string }) => {
      if (onDrillDown) {
         onDrillDown({
            dimension: "categoryId",
            value: category.id,
            label: category.name,
         });
      }
   };

   const chartConfig: ChartConfig = {
      value: {
         color: "hsl(var(--chart-1))",
         label: "Valor",
      },
   };

   return (
      <div className="h-full flex flex-col gap-4 overflow-auto">
         {/* Summary Header */}
         <div className="flex items-center justify-between px-1">
            <div>
               <div className="text-2xl font-bold">
                  {formatDecimalCurrency(total)}
               </div>
               <div className="text-sm text-muted-foreground">
                  Total across {categories.length} categories
               </div>
            </div>
         </div>

         {/* Horizontal Bar Chart */}
         <div className="h-48 min-h-48">
            <ChartContainer className="h-full w-full" config={chartConfig}>
               <BarChart
                  accessibilityLayer
                  data={categories.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
               >
                  <CartesianGrid className="stroke-muted" horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                     axisLine={false}
                     tick={{ fontSize: 10 }}
                     tickFormatter={(value) => formatDecimalCurrency(value)}
                     tickLine={false}
                     type="number"
                  />
                  <YAxis
                     axisLine={false}
                     dataKey="name"
                     tick={{ fontSize: 11 }}
                     tickLine={false}
                     type="category"
                     width={75}
                  />
                  <ChartTooltip
                     content={
                        <ChartTooltipContent
                           formatter={(value) => formatDecimalCurrency(value as number)}
                        />
                     }
                  />
                  <Bar
                     cursor={onDrillDown ? "pointer" : undefined}
                     dataKey="value"
                     radius={[0, 4, 4, 0]}
                  >
                     {categories.slice(0, 8).map((category, index) => (
                        <Cell
                           fill={category.color}
                           key={`cell-${index + 1}`}
                           onClick={() => handleCategoryClick(category)}
                        />
                     ))}
                  </Bar>
               </BarChart>
            </ChartContainer>
         </div>

         {/* Category List with Details */}
         <div className="flex-1 space-y-2 px-1">
            {categories.map((category, index) => {
               const percentage =
                  total > 0 ? (category.value / total) * 100 : 0;

               return (
                  <Card
                     className={cn(
                        "transition-colors",
                        onDrillDown && "cursor-pointer hover:bg-muted/50",
                     )}
                     key={`category-${index + 1}`}
                     onClick={() =>
                        onDrillDown && handleCategoryClick(category)
                     }
                  >
                     <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-4">
                           {/* Category Info */}
                           <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                 className="w-3 h-3 rounded-full shrink-0"
                                 style={{ backgroundColor: category.color }}
                              />
                              <div className="min-w-0">
                                 <div className="font-medium truncate">
                                    {category.name}
                                 </div>
                                 <div className="text-xs text-muted-foreground">
                                    {percentage.toFixed(1)}% of total
                                 </div>
                              </div>
                           </div>

                           {/* Amount */}
                           <div className="text-right shrink-0">
                              <div className="font-medium">
                                 {formatDecimalCurrency(category.value)}
                              </div>
                           </div>
                        </div>

                        {/* Progress bar showing percentage of total */}
                        <div className="mt-2">
                           <Progress
                              className="h-1.5"
                              style={
                                 {
                                    "--progress-background": category.color,
                                 } as React.CSSProperties
                              }
                              value={percentage}
                           />
                        </div>
                     </CardContent>
                  </Card>
               );
            })}
         </div>
      </div>
   );
}

function CategoryAnalysisSkeleton() {
   return (
      <div className="h-full flex flex-col gap-4">
         <div className="space-y-2 px-1">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
         </div>
         <Skeleton className="h-48" />
         <div className="flex-1 space-y-2 px-1">
            {Array.from({ length: 5 }).map((_, i) => (
               <Skeleton className="h-16" key={`skeleton-${i + 1}`} />
            ))}
         </div>
      </div>
   );
}
