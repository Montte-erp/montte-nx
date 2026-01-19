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
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
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
   type RelativePeriod,
   resolveDateRange,
} from "../lib/resolve-date-range";
import { getItemColor, SEMANTIC_COLORS } from "./chart-colors";

/**
 * Parse date strings from various SQL formats into Date objects
 * Handles: YYYY-MM-DD (day), IYYY-IW (week), YYYY-MM (month), YYYY"Q"Q (quarter), YYYY (year)
 */
function parseDateString(dateStr: string): Date | null {
   // Quarter format: "2024Q1", "2024Q2", etc. -> First day of that quarter
   const quarterMatch = dateStr.match(/^(\d{4})Q([1-4])$/);
   if (quarterMatch) {
      const year = Number.parseInt(quarterMatch[1] ?? "0", 10);
      const quarter = Number.parseInt(quarterMatch[2] ?? "1", 10);
      return new Date(year, (quarter - 1) * 3, 1);
   }

   // Standard formats that JS can parse: "2024-01-15", "2024-01", "2024"
   const date = new Date(dateStr);
   return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Get the semantic color based on type filter in config
 * Returns income color (green), expense color (red), or default chart color
 */
function getTypeFilterColor(config: InsightConfig): string {
   const typeFilter = config.filters.find((f) => f.field === "type");
   if (
      typeFilter?.operator === "equals" &&
      typeof typeFilter.value === "string"
   ) {
      if (typeFilter.value === "expense") {
         return SEMANTIC_COLORS.expense;
      }
      if (typeFilter.value === "income") {
         return SEMANTIC_COLORS.income;
      }
   }
   return "var(--chart-1)"; // Default
}

/**
 * Check if the config has an expense-only type filter
 * Used to negate values so expenses are shown below the zero line
 */
function isExpenseOnlyFilter(config: InsightConfig): boolean {
   const typeFilter = config.filters.find((f) => f.field === "type");
   return typeFilter?.operator === "equals" && typeFilter.value === "expense";
}

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

      // Parse and validate dates before passing to forecast
      const dataPoints: Array<{ date: Date; value: number }> = [];
      for (const point of timeSeries) {
         const parsedDate = parseDateString(point.date);
         if (!parsedDate) {
            // If any date fails to parse, skip forecasting entirely
            return { forecastData: [], lastDataDate: null };
         }
         dataPoints.push({ date: parsedDate, value: point.value });
      }

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

   // Check if we have separated income/expense data
   // Use typeof to handle cases where values might be 0 (which is valid)
   const hasSeparatedData = data.timeSeries.some(
      (p) =>
         typeof p.incomeValue === "number" &&
         typeof p.expenseValue === "number",
   );

   // Check if expense-only filter is active (negate values to show below zero)
   const isExpenseOnly = isExpenseOnlyFilter(config);

   // Get semantic color for single type filter
   const singleTypeColor = getTypeFilterColor(config);

   // Merge time series with comparison data if overlay is enabled
   const hasComparisonOverlay =
      config.comparisonOverlay?.enabled && data.comparisonTimeSeries;
   const hasForecast = config.forecast?.enabled && forecastData.length > 0;

   // Build chart data with historical, comparison, and forecast values
   // Negate expense values so they appear below zero line when showing both income/expense
   // Also negate single value when expense-only filter is active
   const chartData = (() => {
      // Start with historical data
      const historical = data.timeSeries.map((point, index) => ({
         date: point.date,
         // Negate value for expense-only filter (shows chart going down)
         value: isExpenseOnly ? -point.value : point.value,
         incomeValue: point.incomeValue,
         // Negate expense values for proper visualization below zero line
         expenseValue:
            point.expenseValue !== undefined ? -point.expenseValue : undefined,
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
            // Negate forecast values for expense-only filter
            const forecastValue = isExpenseOnly ? -fp.value : fp.value;
            const forecastLower = fp.lowerBound
               ? isExpenseOnly
                  ? -fp.lowerBound
                  : fp.lowerBound
               : null;
            const forecastUpper = fp.upperBound
               ? isExpenseOnly
                  ? -fp.upperBound
                  : fp.upperBound
               : null;

            historical.push({
               date: fp.date.toISOString().split("T")[0] ?? "",
               value: null as unknown as number, // No actual value for forecast points
               incomeValue: undefined,
               expenseValue: undefined,
               comparisonValue: null,
               forecastValue,
               forecastLower,
               forecastUpper,
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
         color: singleTypeColor,
         label: config.aggregateField,
      },
      // Use direct oklch colors to avoid CSS variable resolution issues
      // (var(--color-income) -> var(--income) -> oklch is too many levels)
      ...(hasSeparatedData && {
         incomeValue: {
            color: "oklch(0.7227 0.1920 142)", // Green (income)
            label: "Receitas",
         },
         expenseValue: {
            color: "oklch(0.6368 0.2078 25.33)", // Red (expense/destructive)
            label: "Despesas",
         },
      }),
      ...(hasComparisonOverlay && {
         comparisonValue: {
            color: "var(--muted-foreground)",
            label:
               config.comparisonOverlay?.type === "previous_year"
                  ? "Last Year"
                  : "Previous Period",
         },
      }),
      ...(hasForecast && {
         forecastValue: {
            color: "var(--chart-2)",
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

   const showLegend =
      config.showLegend ||
      hasSeparatedData ||
      hasComparisonOverlay ||
      hasForecast;

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
                     formatter={(value, name) => {
                        // Show absolute value for expenses (they're stored as negative)
                        // This includes both separated expense data and expense-only filter
                        const isNegatedValue =
                           name === "expenseValue" ||
                           (name === "value" && isExpenseOnly);
                        const displayValue = isNegatedValue
                           ? Math.abs(value as number)
                           : (value as number);
                        return config.aggregation === "count"
                           ? displayValue.toLocaleString()
                           : formatDecimalCurrency(displayValue);
                     }}
                  />
               }
            />
            {/* Reference line at zero when showing separated income/expense or expense-only */}
            {(hasSeparatedData || isExpenseOnly) && (
               <ReferenceLine
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  y={0}
               />
            )}
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
            {hasSeparatedData ? (
               <>
                  <Line
                     connectNulls
                     dataKey="incomeValue"
                     dot={false}
                     name="Receitas"
                     stroke="var(--color-incomeValue)"
                     strokeWidth={2}
                     type="monotone"
                  />
                  <Line
                     connectNulls
                     dataKey="expenseValue"
                     dot={false}
                     name="Despesas"
                     stroke="var(--color-expenseValue)"
                     strokeWidth={2}
                     type="monotone"
                  />
               </>
            ) : (
               <Line
                  activeDot={
                     onDrillDown ? { r: 6, cursor: "pointer" } : undefined
                  }
                  connectNulls
                  dataKey="value"
                  dot={false}
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  type="monotone"
               />
            )}
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
                        stroke="var(--muted-foreground)"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                        x={lastDataDate}
                     />
                  )}
               </>
            )}
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
         </LineChart>
      </ChartContainer>
   );
}

function BarChartWidget({ data, config, onDrillDown }: ChartComponentProps) {
   // Check if we have separated income/expense data FIRST
   // This must be checked before determining chartData source
   const hasSeparatedData =
      data.timeSeries?.some(
         (p) => p.incomeValue !== undefined && p.expenseValue !== undefined,
      ) ?? false;

   // Check if expense-only filter is active (negate values to show below zero)
   const isExpenseOnly = isExpenseOnlyFilter(config);

   // When we have separated data (income/expense), ALWAYS use timeSeries
   // because breakdown data doesn't contain incomeValue/expenseValue keys
   // Also transform to negate expense values so they appear below zero
   // For expense-only filter, also negate the single value
   const chartData = hasSeparatedData
      ? (data.timeSeries || []).map((point) => ({
           ...point,
           // Negate expense values for proper visualization below zero line
           expenseValue:
              point.expenseValue !== undefined
                 ? -point.expenseValue
                 : undefined,
        }))
      : isExpenseOnly && data.timeSeries
        ? data.timeSeries.map((point) => ({
             ...point,
             // Negate value for expense-only filter
             value: -point.value,
          }))
        : isExpenseOnly && data.breakdown
          ? data.breakdown.map((point) => ({
               ...point,
               // Negate value for expense-only filter
               value: -point.value,
            }))
          : data.breakdown || data.timeSeries || [];

   if (chartData.length === 0) {
      return (
         <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponível
         </div>
      );
   }

   // Get semantic color for single type filter
   const singleTypeColor = getTypeFilterColor(config);

   const chartConfig: ChartConfig = {
      value: {
         color: singleTypeColor,
         label: config.aggregateField,
      },
      // Use direct oklch colors to avoid CSS variable resolution issues
      // (var(--color-income) -> var(--income) -> oklch is too many levels)
      ...(hasSeparatedData && {
         incomeValue: {
            color: "oklch(0.7227 0.1920 142)", // Green (income)
            label: "Receitas",
         },
         expenseValue: {
            color: "oklch(0.6368 0.2078 25.33)", // Red (expense/destructive)
            label: "Despesas",
         },
      }),
   };

   // When using separated data from timeSeries, use "date" as dataKey
   // When using breakdown data, use "label" as dataKey
   const dataKey = hasSeparatedData
      ? "date"
      : data.breakdown
        ? "label"
        : "date";
   const isBreakdown = !hasSeparatedData && Boolean(data.breakdown);

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
                     formatter={(value, name) => {
                        // Show absolute value for expenses (they're stored as negative)
                        // This includes both separated expense data and expense-only filter
                        const isNegatedValue =
                           name === "expenseValue" ||
                           (name === "value" && isExpenseOnly);
                        const displayValue = isNegatedValue
                           ? Math.abs(value as number)
                           : (value as number);
                        return config.aggregation === "count"
                           ? displayValue.toLocaleString()
                           : formatDecimalCurrency(displayValue);
                     }}
                  />
               }
            />
            {/* Reference line at zero when showing separated income/expense or expense-only */}
            {(hasSeparatedData || isExpenseOnly) && (
               <ReferenceLine
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  y={0}
               />
            )}
            {hasSeparatedData ? (
               <>
                  <Bar
                     dataKey="incomeValue"
                     fill="var(--color-incomeValue)"
                     name="Receitas"
                     radius={[4, 4, 0, 0]}
                     stackId="stack"
                  />
                  <Bar
                     dataKey="expenseValue"
                     fill="var(--color-expenseValue)"
                     name="Despesas"
                     radius={[0, 0, 4, 4]}
                     stackId="stack"
                  />
                  <ChartLegend content={<ChartLegendContent />} />
               </>
            ) : (
               <Bar
                  cursor={onDrillDown ? "pointer" : undefined}
                  dataKey="value"
                  fill="var(--color-value)"
                  radius={[4, 4, 0, 0]}
               >
                  {chartData.map((entry, index) => (
                     <Cell
                        fill={
                           isBreakdown
                              ? getItemColor(
                                   (entry as { color?: string }).color,
                                   index,
                                )
                              : "var(--color-value)"
                        }
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
            )}
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
         <PieChart
            accessibilityLayer
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
         >
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

   // Check if we have separated income/expense data
   // Use typeof to handle cases where values might be 0 (which is valid)
   const hasSeparatedData = data.timeSeries.some(
      (p) =>
         typeof p.incomeValue === "number" &&
         typeof p.expenseValue === "number",
   );

   // Check if expense-only filter is active (negate values to show below zero)
   const isExpenseOnly = isExpenseOnlyFilter(config);

   // Get semantic color for single type filter
   const singleTypeColor = getTypeFilterColor(config);

   // Merge time series with comparison data if overlay is enabled
   const hasComparisonOverlay =
      config.comparisonOverlay?.enabled && data.comparisonTimeSeries;
   const hasForecast = config.forecast?.enabled && forecastData.length > 0;

   // Build chart data with historical, comparison, and forecast values
   // Negate expense values so they appear below zero line when showing both income/expense
   // Also negate single value when expense-only filter is active
   const chartData = (() => {
      // Start with historical data
      const historical = data.timeSeries.map((point, index) => ({
         date: point.date,
         // Negate value for expense-only filter (shows chart going down)
         value: isExpenseOnly ? -point.value : point.value,
         incomeValue: point.incomeValue,
         // Negate expense values for proper visualization below zero line
         expenseValue:
            point.expenseValue !== undefined ? -point.expenseValue : undefined,
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
            // Negate forecast values for expense-only filter
            const forecastValue = isExpenseOnly ? -fp.value : fp.value;
            const forecastLower = fp.lowerBound
               ? isExpenseOnly
                  ? -fp.lowerBound
                  : fp.lowerBound
               : null;
            const forecastUpper = fp.upperBound
               ? isExpenseOnly
                  ? -fp.upperBound
                  : fp.upperBound
               : null;

            historical.push({
               date: fp.date.toISOString().split("T")[0] ?? "",
               value: null as unknown as number,
               incomeValue: undefined,
               expenseValue: undefined,
               comparisonValue: null,
               forecastValue,
               forecastLower,
               forecastUpper,
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
         color: singleTypeColor,
         label: config.aggregateField,
      },
      // Use direct oklch colors to avoid CSS variable resolution issues
      // (var(--color-income) -> var(--income) -> oklch is too many levels)
      ...(hasSeparatedData && {
         incomeValue: {
            color: "oklch(0.7227 0.1920 142)", // Green (income)
            label: "Receitas",
         },
         expenseValue: {
            color: "oklch(0.6368 0.2078 25.33)", // Red (expense/destructive)
            label: "Despesas",
         },
      }),
      ...(hasComparisonOverlay && {
         comparisonValue: {
            color: "var(--muted-foreground)",
            label:
               config.comparisonOverlay?.type === "previous_year"
                  ? "Last Year"
                  : "Previous Period",
         },
      }),
      ...(hasForecast && {
         forecastValue: {
            color: "var(--chart-2)",
            label: "Forecast",
         },
      }),
   };

   const showLegend =
      config.showLegend ||
      hasSeparatedData ||
      hasComparisonOverlay ||
      hasForecast;

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
                     formatter={(value, name) => {
                        // Show absolute value for expenses (they're stored as negative)
                        // This includes both separated expense data and expense-only filter
                        const isNegatedValue =
                           name === "expenseValue" ||
                           (name === "value" && isExpenseOnly);
                        const displayValue = isNegatedValue
                           ? Math.abs(value as number)
                           : (value as number);
                        return config.aggregation === "count"
                           ? displayValue.toLocaleString()
                           : formatDecimalCurrency(displayValue);
                     }}
                  />
               }
            />
            {/* Reference line at zero when showing separated income/expense or expense-only */}
            {(hasSeparatedData || isExpenseOnly) && (
               <ReferenceLine
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  y={0}
               />
            )}
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
            {hasSeparatedData ? (
               <>
                  <Area
                     connectNulls
                     dataKey="incomeValue"
                     fill="var(--color-incomeValue)"
                     fillOpacity={0.3}
                     name="Receitas"
                     stroke="var(--color-incomeValue)"
                     strokeWidth={2}
                     type="monotone"
                  />
                  <Area
                     connectNulls
                     dataKey="expenseValue"
                     fill="var(--color-expenseValue)"
                     fillOpacity={0.3}
                     name="Despesas"
                     stroke="var(--color-expenseValue)"
                     strokeWidth={2}
                     type="monotone"
                  />
               </>
            ) : (
               <Area
                  connectNulls
                  dataKey="value"
                  fill="var(--color-value)"
                  fillOpacity={0.3}
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  type="monotone"
               />
            )}
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
                        stroke="var(--muted-foreground)"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                        x={lastDataDate}
                     />
                  )}
               </>
            )}
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
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

   // Check if we have separated income/expense data
   const hasSeparatedData =
      data.timeSeries?.some(
         (p) => p.incomeValue !== undefined && p.expenseValue !== undefined,
      ) ?? false;

   // Check if expense-only filter is active (negate values to show below zero)
   const isExpenseOnly = isExpenseOnlyFilter(config);

   // For stacked bar, we need breakdown data with time series
   // If we have timeSeries and breakdown, create stacked visualization
   // Transform to negate expense values when we have separated data
   // Also negate single value when expense-only filter is active
   const chartData = hasSeparatedData
      ? (data.timeSeries || []).map((point) => ({
           ...point,
           // Negate expense values for proper visualization below zero line
           expenseValue:
              point.expenseValue !== undefined
                 ? -point.expenseValue
                 : undefined,
        }))
      : isExpenseOnly
        ? (data.timeSeries || []).map((point) => ({
             ...point,
             // Negate value for expense-only filter
             value: -point.value,
          }))
        : data.timeSeries || [];

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

   // Get semantic color for single type filter
   const singleTypeColor = getTypeFilterColor(config);

   const chartConfig: ChartConfig = {
      value: {
         color: singleTypeColor,
         label: config.aggregateField,
      },
      // Use direct oklch colors to avoid CSS variable resolution issues
      // (var(--color-income) -> var(--income) -> oklch is too many levels)
      ...(hasSeparatedData && {
         incomeValue: {
            color: "oklch(0.7227 0.1920 142)", // Green (income)
            label: "Receitas",
         },
         expenseValue: {
            color: "oklch(0.6368 0.2078 25.33)", // Red (expense/destructive)
            label: "Despesas",
         },
      }),
   };

   // If we have breakdown data, use it for coloring
   const breakdownLabels = data.breakdown?.map((b) => b.label) || [];

   // Determine if we should show legend
   const showLegend = hasSeparatedData || breakdownLabels.length > 0;

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
                     formatter={(value, name) => {
                        // Show absolute value for expenses (they're stored as negative)
                        // This includes both separated expense data and expense-only filter
                        const isNegatedValue =
                           name === "expenseValue" ||
                           (name === "value" && isExpenseOnly);
                        const displayValue = isNegatedValue
                           ? Math.abs(value as number)
                           : (value as number);
                        return config.aggregation === "count"
                           ? displayValue.toLocaleString()
                           : formatDecimalCurrency(displayValue);
                     }}
                  />
               }
            />
            {/* Reference line at zero when showing separated income/expense or expense-only */}
            {(hasSeparatedData || isExpenseOnly) && (
               <ReferenceLine
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  y={0}
               />
            )}
            {hasSeparatedData ? (
               <>
                  <Bar
                     dataKey="incomeValue"
                     fill="var(--color-incomeValue)"
                     name="Receitas"
                     radius={[4, 4, 0, 0]}
                     stackId="income"
                  />
                  <Bar
                     dataKey="expenseValue"
                     fill="var(--color-expenseValue)"
                     name="Despesas"
                     radius={[4, 4, 0, 0]}
                     stackId="expense"
                  />
               </>
            ) : breakdownLabels.length > 0 ? (
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
            {showLegend && <ChartLegend content={<ChartLegendContent />} />}
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

   // Check if we have separated income/expense data
   // Use typeof to handle cases where values might be 0 (which is valid)
   const hasSeparatedData = data.timeSeries.some(
      (p) =>
         typeof p.incomeValue === "number" &&
         typeof p.expenseValue === "number",
   );

   // Check if expense-only filter is active (negate values to show below zero)
   const isExpenseOnly = isExpenseOnlyFilter(config);

   // Transform to cumulative values
   // When we have separated data, create separate cumulative lines for income and expense
   // When expense-only filter is active, negate the cumulative values
   let cumulative = 0;
   let cumulativeIncome = 0;
   let cumulativeExpense = 0;

   const cumulativeData = data.timeSeries.map((point) => {
      if (hasSeparatedData) {
         cumulativeIncome += point.incomeValue ?? 0;
         cumulativeExpense += point.expenseValue ?? 0;
         return {
            ...point,
            value: point.value,
            cumulativeIncome,
            // Negate cumulative expense for proper visualization below zero line
            cumulativeExpense: -cumulativeExpense,
         };
      }
      cumulative += point.value;
      // Negate cumulative value for expense-only filter
      return { ...point, value: isExpenseOnly ? -cumulative : cumulative };
   });

   // Get semantic color for single type filter
   const singleTypeColor = getTypeFilterColor(config);

   // Use direct oklch colors to avoid CSS variable resolution issues
   // (var(--color-income) -> var(--income) -> oklch is too many levels)
   const chartConfig: ChartConfig = hasSeparatedData
      ? {
           cumulativeIncome: {
              color: "oklch(0.7227 0.1920 142)", // Green (income)
              label: "Receitas (acumulado)",
           },
           cumulativeExpense: {
              color: "oklch(0.6368 0.2078 25.33)", // Red (expense/destructive)
              label: "Despesas (acumulado)",
           },
        }
      : {
           value: {
              color: singleTypeColor,
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
                     formatter={(value, name) => {
                        // Show absolute value for expenses (they're stored as negative)
                        // This includes both separated expense data and expense-only filter
                        const isNegatedValue =
                           name === "cumulativeExpense" ||
                           (name === "value" && isExpenseOnly);
                        const displayValue = isNegatedValue
                           ? Math.abs(value as number)
                           : (value as number);
                        return config.aggregation === "count"
                           ? displayValue.toLocaleString()
                           : formatDecimalCurrency(displayValue);
                     }}
                  />
               }
            />
            {/* Reference line at zero when showing separated income/expense or expense-only */}
            {(hasSeparatedData || isExpenseOnly) && (
               <ReferenceLine
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  y={0}
               />
            )}
            {hasSeparatedData ? (
               <>
                  <Area
                     dataKey="cumulativeIncome"
                     fill="var(--color-cumulativeIncome)"
                     fillOpacity={0.2}
                     name="Receitas (acumulado)"
                     stroke="var(--color-cumulativeIncome)"
                     strokeWidth={2}
                     type="monotone"
                  />
                  <Area
                     dataKey="cumulativeExpense"
                     fill="var(--color-cumulativeExpense)"
                     fillOpacity={0.2}
                     name="Despesas (acumulado)"
                     stroke="var(--color-cumulativeExpense)"
                     strokeWidth={2}
                     type="monotone"
                  />
                  <ChartLegend content={<ChartLegendContent />} />
               </>
            ) : (
               <Area
                  dataKey="value"
                  fill="var(--color-value)"
                  fillOpacity={0.2}
                  stroke="var(--color-value)"
                  strokeWidth={2}
                  type="monotone"
               />
            )}
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

   // Get semantic color for single type filter
   const singleTypeColor = getTypeFilterColor(config);

   const chartConfig: ChartConfig = {
      value: {
         color: singleTypeColor,
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
