import { forecast } from "@packages/analytics/forecasting";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { formatDecimalCurrency } from "@packages/money";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   type ChartConfig,
   ChartContainer,
   ChartLegend,
   ChartLegendContent,
   ChartTooltip,
   ChartTooltipContent,
} from "@packages/ui/components/chart";
import { CollapsibleTrigger } from "@packages/ui/components/collapsible";
import { DataTable } from "@packages/ui/components/data-table";
import { Skeleton } from "@packages/ui/components/skeleton";
import { TrendSparkline } from "@packages/ui/components/sparkline";
import { formatDate } from "@packages/utils/date";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { ChevronDown, Globe, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
   Area,
   AreaChart,
   Bar,
   BarChart,
   CartesianGrid,
   Cell,
   Line,
   LineChart,
   Pie,
   PieChart,
   ReferenceLine,
   XAxis,
   YAxis,
} from "recharts";
import { useTRPC } from "@/integrations/clients";
import type { InsightData } from "../hooks/use-insight-data";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";
import {
   resolveDateRange,
   type RelativePeriod,
} from "../lib/resolve-date-range";
import { CategoryAnalysisChart } from "./category-analysis-chart";
import { getItemColor } from "./chart-colors";
import { ComparisonChart } from "./comparison-chart";
import { HeatmapChart, transformToHeatmapData } from "./heatmap-chart";
import { SankeyChart, transformToSankeyData } from "./sankey-chart";

type InsightWidgetProps = {
   widgetId: string;
   config: InsightConfig;
   globalFilters?: {
      dateRange?: {
         startDate: string;
         endDate: string;
      };
   };
   onDrillDown?: (context: DrillDownContext) => void;
};

export function InsightWidget({
   config,
   globalFilters,
   onDrillDown,
}: InsightWidgetProps) {
   const trpc = useTRPC();

   // Resolve widget-level date range override to actual dates
   const resolvedFilters = useMemo(() => {
      // If widget has a date range override, resolve it to actual dates
      const relativePeriod = config.dateRangeOverride?.relativePeriod;

      if (relativePeriod) {
         const customStart = config.dateRangeOverride?.startDate
            ? new Date(config.dateRangeOverride.startDate)
            : null;
         const customEnd = config.dateRangeOverride?.endDate
            ? new Date(config.dateRangeOverride.endDate)
            : null;

         const { startDate, endDate } = resolveDateRange(
            relativePeriod as RelativePeriod,
            customStart,
            customEnd,
         );

         return {
            ...globalFilters,
            dateRange: { startDate, endDate },
         };
      }

      // Fall back to global filters if no widget-level override
      return globalFilters;
   }, [config.dateRangeOverride, globalFilters]);

   const { data, isLoading, error } = useQuery(
      trpc.dashboards.queryInsight.queryOptions({
         config,
         globalFilters: resolvedFilters,
      }),
   );

   if (isLoading) {
      return <InsightSkeleton chartType={config.chartType} />;
   }

   if (error) {
      return (
         <div className="h-full flex items-center justify-center text-destructive text-sm">
            Falha ao carregar dados
         </div>
      );
   }

   if (!data) {
      return (
         <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponível
         </div>
      );
   }

   switch (config.chartType) {
      case "stat_card":
         return (
            <StatCardChart
               config={config}
               data={data}
               onDrillDown={onDrillDown}
            />
         );
      case "line":
         return (
            <LineChartWidget
               config={config}
               data={data}
               onDrillDown={onDrillDown}
            />
         );
      case "area":
         return (
            <AreaChartWidget
               config={config}
               data={data}
               onDrillDown={onDrillDown}
            />
         );
      case "bar":
         return (
            <BarChartWidget
               config={config}
               data={data}
               onDrillDown={onDrillDown}
            />
         );
      case "stacked_bar":
         return (
            <StackedBarChartWidget
               config={config}
               data={data}
               onDrillDown={onDrillDown}
            />
         );
      case "line_cumulative":
         return (
            <LineCumulativeWidget
               config={config}
               data={data}
               onDrillDown={onDrillDown}
            />
         );
      case "pie":
      case "donut":
         return (
            <PieChartWidget
               config={config}
               data={data}
               isDonut={config.chartType === "donut"}
               onDrillDown={onDrillDown}
            />
         );
      case "bar_total":
         return (
            <BarTotalWidget
               config={config}
               data={data}
               onDrillDown={onDrillDown}
            />
         );
      case "table":
         return (
            <TableWidget
               config={config}
               data={data}
               onDrillDown={onDrillDown}
            />
         );
      case "world_map":
         return (
            <WorldMapWidget
               config={config}
               data={data}
               onDrillDown={onDrillDown}
            />
         );
      case "category_analysis":
         return (
            <CategoryAnalysisChart
               config={config}
               globalFilters={globalFilters}
               onDrillDown={onDrillDown}
            />
         );
      case "comparison":
         return (
            <ComparisonChart
               config={config}
               globalFilters={globalFilters}
               onDrillDown={onDrillDown}
            />
         );
      case "sankey":
         return <SankeyChartWidget config={config} data={data} />;
      case "heatmap":
         return <HeatmapChartWidget config={config} data={data} />;
      default:
         return (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
               Unsupported chart type
            </div>
         );
   }
}

function InsightSkeleton({ chartType }: { chartType: string }) {
   if (chartType === "stat_card") {
      return (
         <div className="h-full flex flex-col justify-center">
            <Skeleton className="h-10 w-32 mb-2" />
            <Skeleton className="h-4 w-24" />
         </div>
      );
   }
   return <Skeleton className="h-full w-full" />;
}

type ChartComponentProps = {
   data: InsightData;
   config: InsightConfig;
   onDrillDown?: (context: DrillDownContext) => void;
};

/**
 * Generate forecast data for time series charts
 */
function useForecastData(
   timeSeries: Array<{ date: string; value: number }> | undefined,
   forecastConfig: InsightConfig["forecast"],
) {
   return useMemo(() => {
      if (!forecastConfig?.enabled || !timeSeries || timeSeries.length < 3) {
         return { forecastData: [], lastDataDate: null };
      }

      const dataPoints = timeSeries.map((point) => ({
         date: point.date,
         value: point.value,
      }));

      const result = forecast(
         dataPoints,
         forecastConfig.model,
         forecastConfig.periods,
         {
            confidenceLevel: 0.95,
         },
      );

      const lastDataDate = timeSeries[timeSeries.length - 1]?.date;

      return {
         forecastData: result.forecasts,
         lastDataDate,
      };
   }, [timeSeries, forecastConfig]);
}

function StatCardChart({ data, config, onDrillDown }: ChartComponentProps) {
   const formattedValue =
      config.aggregation === "count"
         ? data.value.toLocaleString()
         : formatDecimalCurrency(data.value);

   const hasComparison = data.comparison && config.comparison;
   const isPositive = data.comparison ? data.comparison.change >= 0 : true;

   const handleClick = () => {
      if (onDrillDown && config.breakdown?.field) {
         // For stat cards, clicking opens a breakdown view
         onDrillDown({
            dimension: "view",
            value: "breakdown",
            label: "View breakdown",
         });
      }
   };

   // Prepare sparkline data from timeSeries
   const sparklineData =
      data.timeSeries?.map((point) => ({ value: point.value })) ?? [];
   const showSparkline = config.miniChart && sparklineData.length > 1;

   return (
      <div
         className={`h-full flex flex-col justify-center ${onDrillDown ? "cursor-pointer hover:bg-muted/30 transition-colors rounded-lg p-2 -m-2" : ""}`}
         onClick={handleClick}
         onKeyDown={(e) => e.key === "Enter" && handleClick()}
         role={onDrillDown ? "button" : undefined}
         tabIndex={onDrillDown ? 0 : undefined}
      >
         <div className="flex items-end gap-4">
            <div className="flex-1">
               <div className="text-3xl font-bold">{formattedValue}</div>
               {hasComparison && data.comparison && (
                  <div
                     className={`flex items-center gap-1 text-sm ${
                        isPositive ? "text-green-600" : "text-red-600"
                     }`}
                  >
                     {isPositive ? (
                        <TrendingUp className="h-4 w-4" />
                     ) : (
                        <TrendingDown className="h-4 w-4" />
                     )}
                     <span>
                        {isPositive ? "+" : ""}
                        {data.comparison.changePercent.toFixed(1)}%
                     </span>
                     <span className="text-muted-foreground">
                        vs{" "}
                        {config.comparison?.type === "previous_year"
                           ? "last year"
                           : "previous period"}
                     </span>
                  </div>
               )}
            </div>
            {showSparkline && (
               <div className="w-24 flex-shrink-0">
                  <TrendSparkline
                     data={sparklineData}
                     height={40}
                     variant={
                        config.miniChart?.type === "bar"
                           ? "bar"
                           : config.miniChart?.type === "area"
                             ? "area"
                             : "line"
                     }
                  />
               </div>
            )}
         </div>
      </div>
   );
}

function LineChartWidget({ data, config, onDrillDown }: ChartComponentProps) {
   // Line chart drill-down is visual only for now (activeDot highlight)
   // Full click handling requires custom Recharts components
   void onDrillDown; // Acknowledge prop for future use

   // Generate forecast data if enabled
   const { forecastData, lastDataDate } = useForecastData(
      data.timeSeries,
      config.forecast,
   );

   if (!data.timeSeries || data.timeSeries.length === 0) {
      return (
         <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-1">
            <span>No time series data</span>
            {!config.timeGrouping && (
               <span className="text-xs">Enable time grouping in options</span>
            )}
         </div>
      );
   }

   // Merge time series with comparison data if overlay is enabled
   const hasComparisonOverlay =
      config.comparisonOverlay?.enabled && data.comparisonTimeSeries;
   const hasForecast = config.forecast?.enabled && forecastData.length > 0;

   // Build chart data with historical, comparison, and forecast values
   const chartData = (() => {
      // Start with historical data
      const historical = data.timeSeries.map((point, index) => ({
         date: point.date,
         value: point.value,
         comparisonValue: hasComparisonOverlay
            ? (data.comparisonTimeSeries?.[index]?.value ?? null)
            : null,
         forecastValue: null as number | null,
         forecastLower: null as number | null,
         forecastUpper: null as number | null,
      }));

      // Add forecast data points if enabled
      if (hasForecast) {
         for (const fp of forecastData) {
            historical.push({
               date: fp.date.toISOString().split("T")[0] ?? "",
               value: null as unknown as number, // No actual value for forecast points
               comparisonValue: null,
               forecastValue: fp.value,
               forecastLower: fp.lowerBound ?? null,
               forecastUpper: fp.upperBound ?? null,
            });
         }

         // Connect forecast to last data point
         if (historical.length > forecastData.length) {
            const lastHistoricalIndex =
               historical.length - forecastData.length - 1;
            const lastHistorical = historical[lastHistoricalIndex];
            if (lastHistorical) {
               lastHistorical.forecastValue = lastHistorical.value;
            }
         }
      }

      return historical;
   })();

   const chartConfig: ChartConfig = {
      value: {
         color: "hsl(var(--chart-1))",
         label: config.aggregateField,
      },
      ...(hasComparisonOverlay && {
         comparisonValue: {
            color: "hsl(var(--muted-foreground))",
            label:
               config.comparisonOverlay?.type === "previous_year"
                  ? "Last Year"
                  : "Previous Period",
         },
      }),
      ...(hasForecast && {
         forecastValue: {
            color: "hsl(var(--chart-2))",
            label: "Forecast",
         },
      }),
   };

   const getStrokeDasharray = () => {
      switch (config.comparisonOverlay?.style) {
         case "dotted":
            return "2 2";
         case "dashed":
            return "5 5";
         default:
            return undefined;
      }
   };

   return (
      <ChartContainer className="h-full w-full" config={chartConfig}>
         <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
         >
            <CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
            <XAxis
               axisLine={false}
               dataKey="date"
               tick={{ fontSize: 10 }}
               tickLine={false}
            />
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
            {hasComparisonOverlay && (
               <Line
                  connectNulls
                  dataKey="comparisonValue"
                  dot={false}
                  stroke="var(--color-comparisonValue)"
                  strokeDasharray={getStrokeDasharray()}
                  strokeWidth={1.5}
                  type="monotone"
               />
            )}
            <Line
               activeDot={onDrillDown ? { r: 6, cursor: "pointer" } : undefined}
               connectNulls
               dataKey="value"
               dot={false}
               stroke="var(--color-value)"
               strokeWidth={2}
               type="monotone"
            />
            {hasForecast && (
               <>
                  {/* Forecast confidence interval area */}
                  {config.forecast?.showConfidenceInterval && (
                     <Area
                        connectNulls
                        dataKey="forecastUpper"
                        fill="var(--color-forecastValue)"
                        fillOpacity={0.1}
                        stroke="none"
                        type="monotone"
                     />
                  )}
                  {/* Forecast line */}
                  <Line
                     connectNulls
                     dataKey="forecastValue"
                     dot={false}
                     stroke="var(--color-forecastValue)"
                     strokeDasharray="5 5"
                     strokeWidth={2}
                     type="monotone"
                  />
                  {/* Reference line at forecast start */}
                  {lastDataDate && (
                     <ReferenceLine
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                        x={lastDataDate}
                     />
                  )}
               </>
            )}
            {(hasComparisonOverlay || hasForecast) && config.showLegend && (
               <ChartLegend content={<ChartLegendContent />} />
            )}
         </LineChart>
      </ChartContainer>
   );
}

function BarChartWidget({ data, config, onDrillDown }: ChartComponentProps) {
   const chartData = data.breakdown || data.timeSeries || [];

   if (chartData.length === 0) {
      return (
         <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponível
         </div>
      );
   }

   const chartConfig: ChartConfig = {
      value: {
         color: "hsl(var(--chart-1))",
         label: config.aggregateField,
      },
   };

   const dataKey = data.breakdown ? "label" : "date";
   const isBreakdown = Boolean(data.breakdown);

   const handleBarClick = (entry: {
      label?: string;
      date?: string;
      id?: string;
      value: number;
   }) => {
      if (!onDrillDown) return;

      if (isBreakdown && config.breakdown?.field) {
         onDrillDown({
            dimension: config.breakdown.field,
            value: entry.id || entry.label || "",
            label: entry.label || "",
         });
      } else if (entry.date) {
         onDrillDown({
            dimension: "date",
            value: entry.date,
            label: entry.date,
         });
      }
   };

   return (
      <ChartContainer className="h-full w-full" config={chartConfig}>
         <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
         >
            <CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
            <XAxis
               axisLine={false}
               dataKey={dataKey}
               tick={{ fontSize: 10 }}
               tickLine={false}
            />
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
            <Bar
               cursor={onDrillDown ? "pointer" : undefined}
               dataKey="value"
               radius={[4, 4, 0, 0]}
            >
               {chartData.map((entry, index) => (
                  <Cell
                     fill={getItemColor(
                        (entry as { color?: string }).color,
                        index,
                     )}
                     key={`cell-${index + 1}`}
                     onClick={() =>
                        handleBarClick(
                           entry as {
                              label?: string;
                              date?: string;
                              id?: string;
                              value: number;
                           },
                        )
                     }
                  />
               ))}
            </Bar>
         </BarChart>
      </ChartContainer>
   );
}

function PieChartWidget({
   data,
   config,
   isDonut,
   onDrillDown,
}: ChartComponentProps & { isDonut: boolean }) {
   if (!data.breakdown || data.breakdown.length === 0) {
      return (
         <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-1">
            <span>No breakdown data</span>
            {!config.breakdown && (
               <span className="text-xs">Enable breakdown in options</span>
            )}
         </div>
      );
   }

   const chartConfig: ChartConfig = {};
   data.breakdown.forEach((item, index) => {
      chartConfig[item.label] = {
         color: getItemColor(item.color, index),
         label: item.label,
      };
   });

   const handleSliceClick = (entry: {
      id?: string;
      label: string;
      value: number;
   }) => {
      if (!onDrillDown || !config.breakdown?.field) return;

      onDrillDown({
         dimension: config.breakdown.field,
         value: entry.id || entry.label,
         label: entry.label,
      });
   };

   return (
      <ChartContainer className="h-full w-full" config={chartConfig}>
         <PieChart accessibilityLayer margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
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
            <Pie
               cursor={onDrillDown ? "pointer" : undefined}
               data={data.breakdown}
               dataKey="value"
               innerRadius={isDonut ? "50%" : 0}
               nameKey="label"
               outerRadius="80%"
               paddingAngle={2}
               stroke="none"
            >
               {data.breakdown.map((entry, index) => (
                  <Cell
                     fill={getItemColor(entry.color, index)}
                     key={`cell-${index + 1}`}
                     onClick={() => handleSliceClick(entry)}
                  />
               ))}
            </Pie>
         </PieChart>
      </ChartContainer>
   );
}

type TableRow = Record<string, unknown>;

/**
 * Utility function to format cell values based on column type
 */
function formatCellValue(
   col: string,
   value: unknown,
   decryptE2E?: (value: string) => string,
): string {
   // Handle null/undefined
   if (value === null || value === undefined) {
      return "-";
   }

   // Date formatting
   const colLower = col.toLowerCase();
   if (
      colLower.includes("date") ||
      colLower === "createdat" ||
      colLower === "updatedat"
   ) {
      if (value instanceof Date) {
         return formatDate(value, "DD/MM/YYYY");
      }
      if (typeof value === "string") {
         const date = new Date(value);
         if (!Number.isNaN(date.getTime())) {
            return formatDate(date, "DD/MM/YYYY");
         }
      }
   }

   // Amount/currency formatting
   if (
      colLower.includes("amount") ||
      colLower.includes("value") ||
      colLower.includes("total") ||
      colLower.includes("balance")
   ) {
      if (typeof value === "number") {
         return formatDecimalCurrency(value);
      }
      if (typeof value === "string") {
         const num = Number.parseFloat(value);
         if (!Number.isNaN(num)) {
            return formatDecimalCurrency(num);
         }
      }
   }

   // E2E encrypted value handling (fallback for any remaining encrypted data)
   if (typeof value === "string" && decryptE2E) {
      try {
         const parsed = JSON.parse(value);
         // Check for E2E encryption format
         if (parsed.encrypted && parsed.nonce && parsed.version) {
            return decryptE2E(value);
         }
      } catch {
         // Not encrypted JSON, continue with normal formatting
      }
   }

   return String(value);
}

function createTableColumns(
   allColumns: string[],
   config: InsightConfig,
   decryptE2E?: (value: string) => string,
): ColumnDef<TableRow>[] {
   const visibleColumns = config.tableColumns?.visibleColumns;
   const columnOrder = config.tableColumns?.columnOrder;

   // Determine which columns to show
   let columnsToShow = allColumns;
   if (visibleColumns && visibleColumns.length > 0) {
      columnsToShow = visibleColumns.filter((col) => allColumns.includes(col));
   }

   // Apply column order if specified
   if (columnOrder && columnOrder.length > 0) {
      columnsToShow = columnOrder.filter((col) => columnsToShow.includes(col));
      // Add any remaining columns not in the order
      const remainingCols = columnsToShow.filter(
         (col) => !columnOrder.includes(col),
      );
      columnsToShow = [...columnsToShow, ...remainingCols];
   }

   return columnsToShow.map((col) => ({
      accessorKey: col,
      header: col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, " "),
      cell: ({ row }) => {
         const value = row.original[col];
         return formatCellValue(col, value, decryptE2E);
      },
      enableSorting: true,
   }));
}

function TableExpandedContent({
   row,
   allColumns,
   decryptE2E,
}: {
   row: Row<TableRow>;
   allColumns: string[];
   decryptE2E?: (value: string) => string;
}) {
   const data = row.original;

   return (
      <div className="p-4 space-y-3">
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {allColumns.map((col) => {
               const value = data[col];
               const formattedValue = formatCellValue(col, value, decryptE2E);

               return (
                  <div className="flex flex-col gap-0.5" key={col}>
                     <span className="text-xs text-muted-foreground">
                        {col.charAt(0).toUpperCase() +
                           col.slice(1).replace(/_/g, " ")}
                     </span>
                     <span className="text-sm font-medium truncate">
                        {formattedValue}
                     </span>
                  </div>
               );
            })}
         </div>
      </div>
   );
}

function TableMobileCard({
   row,
   isExpanded,
   toggleExpanded,
   allColumns,
   decryptE2E,
}: {
   row: Row<TableRow>;
   isExpanded: boolean;
   toggleExpanded: () => void;
   allColumns: string[];
   decryptE2E?: (value: string) => string;
}) {
   const data = row.original;
   // Show first 3 columns as key info
   const keyColumns = allColumns.slice(0, 3);

   const getDisplayValue = (col: string) => {
      const value = data[col];
      return formatCellValue(col, value, decryptE2E);
   };

   return (
      <Card className={isExpanded ? "rounded-b-none py-4" : "py-4"}>
         <CardHeader className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
               <CardTitle className="text-sm truncate">
                  {getDisplayValue(keyColumns[0] ?? "")}
               </CardTitle>
               {keyColumns[1] && (
                  <CardDescription>
                     {keyColumns[1].charAt(0).toUpperCase() +
                        keyColumns[1].slice(1).replace(/_/g, " ")}
                     : {getDisplayValue(keyColumns[1])}
                  </CardDescription>
               )}
            </div>
         </CardHeader>
         {keyColumns[2] && (
            <CardContent className="flex flex-wrap items-center gap-2">
               <span className="text-sm text-muted-foreground">
                  {keyColumns[2].charAt(0).toUpperCase() +
                     keyColumns[2].slice(1).replace(/_/g, " ")}
                  : {getDisplayValue(keyColumns[2])}
               </span>
            </CardContent>
         )}
         <CardFooter>
            <CollapsibleTrigger asChild onClick={toggleExpanded}>
               <Button className="w-full" variant="outline">
                  <ChevronDown
                     className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
                  {isExpanded ? "Less" : "More"}
               </Button>
            </CollapsibleTrigger>
         </CardFooter>
      </Card>
   );
}

function TableWidget({ data, config, onDrillDown }: ChartComponentProps) {
   void onDrillDown; // Reserved for future drill-down support
   const firstRow = data.tableData?.[0];
   const [page, setPage] = useState(1);
   const pageSize = 20;

   if (!data.tableData || data.tableData.length === 0 || !firstRow) {
      return (
         <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponível
         </div>
      );
   }

   // Note: E2E decryption fallback removed for now - server-side decryption handles most cases
   const decryptE2E = undefined;

   const allColumns = Object.keys(firstRow);
   const columns = createTableColumns(allColumns, config, decryptE2E);

   // Paginate data
   const totalCount = data.tableData.length;
   const totalPages = Math.ceil(totalCount / pageSize);
   const paginatedData = data.tableData.slice(
      (page - 1) * pageSize,
      page * pageSize,
   );

   return (
      <div className="h-full overflow-auto">
         <DataTable
            columns={columns}
            data={paginatedData}
            pagination={
               totalCount > pageSize
                  ? {
                       currentPage: page,
                       totalPages,
                       totalCount,
                       pageSize,
                       onPageChange: setPage,
                    }
                  : undefined
            }
            renderMobileCard={(props) => (
               <TableMobileCard
                  {...props}
                  allColumns={allColumns}
                  decryptE2E={decryptE2E}
               />
            )}
            renderSubComponent={({ row }) => (
               <TableExpandedContent
                  allColumns={allColumns}
                  decryptE2E={decryptE2E}
                  row={row}
               />
            )}
         />
      </div>
   );
}

function AreaChartWidget({ data, config, onDrillDown }: ChartComponentProps) {
   void onDrillDown;

   // Generate forecast data if enabled
   const { forecastData, lastDataDate } = useForecastData(
      data.timeSeries,
      config.forecast,
   );

   if (!data.timeSeries || data.timeSeries.length === 0) {
      return (
         <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-1">
            <span>No time series data</span>
            {!config.timeGrouping && (
               <span className="text-xs">Enable time grouping in options</span>
            )}
         </div>
      );
   }

   // Merge time series with comparison data if overlay is enabled
   const hasComparisonOverlay =
      config.comparisonOverlay?.enabled && data.comparisonTimeSeries;
   const hasForecast = config.forecast?.enabled && forecastData.length > 0;

   // Build chart data with historical, comparison, and forecast values
   const chartData = (() => {
      // Start with historical data
      const historical = data.timeSeries.map((point, index) => ({
         date: point.date,
         value: point.value,
         comparisonValue: hasComparisonOverlay
            ? (data.comparisonTimeSeries?.[index]?.value ?? null)
            : null,
         forecastValue: null as number | null,
         forecastLower: null as number | null,
         forecastUpper: null as number | null,
      }));

      // Add forecast data points if enabled
      if (hasForecast) {
         for (const fp of forecastData) {
            historical.push({
               date: fp.date.toISOString().split("T")[0] ?? "",
               value: null as unknown as number,
               comparisonValue: null,
               forecastValue: fp.value,
               forecastLower: fp.lowerBound ?? null,
               forecastUpper: fp.upperBound ?? null,
            });
         }

         // Connect forecast to last data point
         if (historical.length > forecastData.length) {
            const lastHistoricalIndex =
               historical.length - forecastData.length - 1;
            const lastHistorical = historical[lastHistoricalIndex];
            if (lastHistorical) {
               lastHistorical.forecastValue = lastHistorical.value;
            }
         }
      }

      return historical;
   })();

   const chartConfig: ChartConfig = {
      value: {
         color: "hsl(var(--chart-1))",
         label: config.aggregateField,
      },
      ...(hasComparisonOverlay && {
         comparisonValue: {
            color: "hsl(var(--muted-foreground))",
            label:
               config.comparisonOverlay?.type === "previous_year"
                  ? "Last Year"
                  : "Previous Period",
         },
      }),
      ...(hasForecast && {
         forecastValue: {
            color: "hsl(var(--chart-2))",
            label: "Forecast",
         },
      }),
   };

   return (
      <ChartContainer className="h-full w-full" config={chartConfig}>
         <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
         >
            <CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
            <XAxis
               axisLine={false}
               dataKey="date"
               tick={{ fontSize: 10 }}
               tickLine={false}
            />
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
            {hasComparisonOverlay && (
               <Area
                  connectNulls
                  dataKey="comparisonValue"
                  fill="var(--color-comparisonValue)"
                  fillOpacity={0.1}
                  stroke="var(--color-comparisonValue)"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  type="monotone"
               />
            )}
            <Area
               connectNulls
               dataKey="value"
               fill="var(--color-value)"
               fillOpacity={0.3}
               stroke="var(--color-value)"
               strokeWidth={2}
               type="monotone"
            />
            {hasForecast && (
               <>
                  {/* Forecast confidence interval */}
                  {config.forecast?.showConfidenceInterval && (
                     <Area
                        connectNulls
                        dataKey="forecastUpper"
                        fill="var(--color-forecastValue)"
                        fillOpacity={0.1}
                        stroke="none"
                        type="monotone"
                     />
                  )}
                  {/* Forecast area */}
                  <Area
                     connectNulls
                     dataKey="forecastValue"
                     fill="var(--color-forecastValue)"
                     fillOpacity={0.15}
                     stroke="var(--color-forecastValue)"
                     strokeDasharray="5 5"
                     strokeWidth={2}
                     type="monotone"
                  />
                  {/* Reference line at forecast start */}
                  {lastDataDate && (
                     <ReferenceLine
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                        x={lastDataDate}
                     />
                  )}
               </>
            )}
            {(hasComparisonOverlay || hasForecast) && config.showLegend && (
               <ChartLegend content={<ChartLegendContent />} />
            )}
         </AreaChart>
      </ChartContainer>
   );
}

function StackedBarChartWidget({
   data,
   config,
   onDrillDown,
}: ChartComponentProps) {
   void onDrillDown;

   // For stacked bar, we need breakdown data with time series
   // If we have timeSeries and breakdown, create stacked visualization
   const chartData = data.timeSeries || [];

   if (chartData.length === 0) {
      return (
         <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-1">
            <span>No time series data</span>
            {!config.timeGrouping && (
               <span className="text-xs">Enable time grouping in options</span>
            )}
         </div>
      );
   }

   const chartConfig: ChartConfig = {
      value: {
         color: "hsl(var(--chart-1))",
         label: config.aggregateField,
      },
   };

   // If we have breakdown data, use it for coloring
   const breakdownLabels = data.breakdown?.map((b) => b.label) || [];

   return (
      <ChartContainer className="h-full w-full" config={chartConfig}>
         <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
         >
            <CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
            <XAxis
               axisLine={false}
               dataKey="date"
               tick={{ fontSize: 10 }}
               tickLine={false}
            />
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
            {breakdownLabels.length > 0 ? (
               breakdownLabels.map((label, index) => (
                  <Bar
                     dataKey={label}
                     fill={getItemColor(undefined, index)}
                     key={label}
                     radius={
                        index === breakdownLabels.length - 1
                           ? [4, 4, 0, 0]
                           : [0, 0, 0, 0]
                     }
                     stackId="stack"
                  />
               ))
            ) : (
               <Bar
                  dataKey="value"
                  fill="var(--color-value)"
                  radius={[4, 4, 0, 0]}
                  stackId="stack"
               />
            )}
            {breakdownLabels.length > 0 && (
               <ChartLegend content={<ChartLegendContent />} />
            )}
         </BarChart>
      </ChartContainer>
   );
}

function LineCumulativeWidget({
   data,
   config,
   onDrillDown,
}: ChartComponentProps) {
   void onDrillDown;

   if (!data.timeSeries || data.timeSeries.length === 0) {
      return (
         <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-1">
            <span>No time series data</span>
            {!config.timeGrouping && (
               <span className="text-xs">Enable time grouping in options</span>
            )}
         </div>
      );
   }

   // Transform to cumulative values
   let cumulative = 0;
   const cumulativeData = data.timeSeries.map((point) => {
      cumulative += point.value;
      return { ...point, value: cumulative };
   });

   const chartConfig: ChartConfig = {
      value: {
         color: "hsl(var(--chart-1))",
         label: `Cumulative ${config.aggregateField}`,
      },
   };

   return (
      <ChartContainer className="h-full w-full" config={chartConfig}>
         <AreaChart
            accessibilityLayer
            data={cumulativeData}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
         >
            <CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
            <XAxis
               axisLine={false}
               dataKey="date"
               tick={{ fontSize: 10 }}
               tickLine={false}
            />
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
            <Area
               dataKey="value"
               fill="var(--color-value)"
               fillOpacity={0.2}
               stroke="var(--color-value)"
               strokeWidth={2}
               type="monotone"
            />
         </AreaChart>
      </ChartContainer>
   );
}

function BarTotalWidget({ data, config, onDrillDown }: ChartComponentProps) {
   if (!data.breakdown || data.breakdown.length === 0) {
      return (
         <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-1">
            <span>No breakdown data</span>
            {!config.breakdown && (
               <span className="text-xs">Enable breakdown in options</span>
            )}
         </div>
      );
   }

   const chartConfig: ChartConfig = {
      value: {
         color: "hsl(var(--chart-1))",
         label: config.aggregateField,
      },
   };

   const handleBarClick = (entry: {
      id?: string;
      label: string;
      value: number;
   }) => {
      if (!onDrillDown || !config.breakdown?.field) return;

      onDrillDown({
         dimension: config.breakdown.field,
         value: entry.id || entry.label,
         label: entry.label,
      });
   };

   return (
      <ChartContainer className="h-full w-full" config={chartConfig}>
         <BarChart
            accessibilityLayer
            data={data.breakdown}
            layout="vertical"
            margin={{ top: 5, right: 20, bottom: 5, left: 80 }}
         >
            <CartesianGrid
               className="stroke-muted"
               horizontal={false}
               strokeDasharray="3 3"
            />
            <XAxis
               axisLine={false}
               tick={{ fontSize: 10 }}
               tickFormatter={(value) =>
                  config.aggregation === "count"
                     ? value.toLocaleString()
                     : formatDecimalCurrency(value)
               }
               tickLine={false}
               type="number"
            />
            <YAxis
               axisLine={false}
               dataKey="label"
               tick={{ fontSize: 10 }}
               tickLine={false}
               type="category"
               width={75}
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
            <Bar
               cursor={onDrillDown ? "pointer" : undefined}
               dataKey="value"
               radius={[0, 4, 4, 0]}
            >
               {data.breakdown.map((entry, index) => (
                  <Cell
                     fill={getItemColor(entry.color, index)}
                     key={`cell-${index + 1}`}
                     onClick={() => handleBarClick(entry)}
                  />
               ))}
            </Bar>
         </BarChart>
      </ChartContainer>
   );
}

function WorldMapWidget({ config }: ChartComponentProps) {
   void config;

   return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
         <Globe className="h-12 w-12 mb-3 opacity-50" />
         <span className="text-sm font-medium">World Map</span>
         <span className="text-xs mt-1">Coming soon</span>
      </div>
   );
}

function SankeyChartWidget({ data, config }: ChartComponentProps) {
   void config; // Reserved for future configuration options

   // Transform breakdown data into Sankey format
   // Source nodes: income sources (or bank accounts)
   // Target nodes: expense categories
   const sankeyData = (() => {
      if (!data.breakdown?.length) {
         return { nodes: [], links: [] };
      }

      // For simplicity, we'll assume breakdown contains category data
      // and use a single "Income" source flowing to all categories
      const incomeBySource = [{ name: "Receita", value: data.value }];
      const expensesByCategory = data.breakdown.map((item) => ({
         name: item.label,
         value: item.value,
      }));

      return transformToSankeyData(incomeBySource, expensesByCategory);
   })();

   return (
      <div className="h-full">
         <SankeyChart data={sankeyData} height={300} />
      </div>
   );
}

function HeatmapChartWidget({ data, config }: ChartComponentProps) {
   // Transform time series data into heatmap format
   // Each data point should have a date and value
   const heatmapData = (() => {
      if (!data.timeSeries?.length) {
         // If no time series, return empty heatmap
         return { cells: [], maxValue: 0 };
      }

      // Transform time series to transaction-like format
      const transactions = data.timeSeries.map((point) => ({
         date: new Date(point.date),
         amount: point.value,
      }));

      return transformToHeatmapData(transactions);
   })();

   return (
      <div className="h-full">
         <HeatmapChart
            colorScale={config.dataSource === "transactions" ? "red" : "blue"}
            data={heatmapData}
            height={300}
         />
      </div>
   );
}
