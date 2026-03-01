import {
   type ChartConfig,
   ChartContainer,
   ChartLegend,
   ChartLegendContent,
   ChartTooltip,
   ChartTooltipContent,
} from "@packages/ui/components/chart";
import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

interface TrendsBarChartProps {
   data: Array<Record<string, unknown>>;
   series: Array<{ key: string; label: string; color: string }>;
   xAxisKey: string;
   height?: number;
   xAxisFormatter?: (value: string) => string;
   valueFormatter?: (value: number) => string;
   comparisonData?: Array<Record<string, unknown>>;
   /** Per-bar colors — when provided, each bar gets its own fill via Cell */
   cellColors?: (string | null | undefined)[];
   /**
    * Series keys whose values are stored as negatives in the data.
    * The Y-axis ticks and tooltip will display their absolute value,
    * while the tooltip label will be prefixed with "−" to communicate negativity.
    */
   negativeKeys?: string[];
}

export const TrendsBarChart = memo(function TrendsBarChart({
   data,
   series,
   xAxisKey,
   height = 300,
   xAxisFormatter,
   valueFormatter,
   comparisonData,
   cellColors,
   negativeKeys = [],
}: TrendsBarChartProps) {
   // chartConfig must be declared before tooltipFormatter (closes over it)
   const chartConfig = useMemo(() => {
      const config: ChartConfig = {};
      for (const s of series) {
         config[s.key] = { label: s.label, color: s.color };
      }
      if (comparisonData) {
         for (const s of series) {
            config[`${s.key}_comp`] = {
               label: `${s.label} (prev)`,
               color: s.color,
            };
         }
      }
      return config;
   }, [series, comparisonData]);

   const negativeKeySet = useMemo(() => new Set(negativeKeys), [negativeKeys]);

   // Y-axis always shows absolute values so negative ticks read as positive currency
   const yAxisFormatter = useMemo(() => {
      if (!valueFormatter) return undefined;
      return (value: number) => valueFormatter(Math.abs(value));
   }, [valueFormatter]);

   const tooltipFormatter = useMemo(() => {
      if (!valueFormatter) return undefined;
      return (value: unknown, name: unknown) => {
         const label = chartConfig[name as string]?.label ?? name;
         const numVal = Number(value);
         const isNegative = negativeKeySet.has(name as string);
         // Always display absolute amount; prefix with "−" for negative series
         const formatted =
            (isNegative ? "−" : "") + valueFormatter(Math.abs(numVal));
         return (
            <div className="flex items-center gap-2 w-full">
               <div
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{
                     background: `var(--color-${name})`,
                  }}
               />
               <span className="text-muted-foreground">{String(label)}</span>
               <span className="ml-auto pl-4 font-mono font-medium tabular-nums">
                  {formatted}
               </span>
            </div>
         );
      };
   }, [valueFormatter, negativeKeySet, chartConfig]);

   const mergedData = useMemo(() => {
      if (!comparisonData) return data;
      return data.map((point, i) => {
         const compPoint = comparisonData[i];
         if (!compPoint) return point;
         const merged: Record<string, unknown> = { ...point };
         for (const s of series) {
            if (compPoint[s.key] !== undefined) {
               merged[`${s.key}_comp`] = compPoint[s.key];
            }
         }
         return merged;
      });
   }, [data, comparisonData, series]);

   return (
      <ChartContainer
         className="w-full aspect-auto"
         config={chartConfig}
         style={{ height: `${height}px` }}
      >
         <BarChart
            data={mergedData}
            margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
         >
            <CartesianGrid
               className="stroke-muted/20"
               strokeDasharray="0"
               vertical={false}
            />
            <XAxis
               axisLine={false}
               className="text-xs"
               dataKey={xAxisKey}
               tickFormatter={xAxisFormatter}
               tickLine={false}
               tickMargin={8}
            />
            <YAxis
               axisLine={false}
               className="text-xs"
               tickFormatter={yAxisFormatter}
               tickLine={false}
               tickMargin={8}
               width={valueFormatter ? 80 : 40}
            />
            {comparisonData &&
               series.map((s) => (
                  <Bar
                     dataKey={`${s.key}_comp`}
                     fill={`var(--color-${s.key})`}
                     fillOpacity={0.2}
                     key={`${s.key}_comp`}
                     radius={[4, 4, 0, 0]}
                  />
               ))}
            {series.map((s) => (
               <Bar
                  dataKey={s.key}
                  fill={`var(--color-${s.key})`}
                  key={s.key}
                  radius={[4, 4, 0, 0]}
               >
                  {cellColors?.map((color, i) => (
                     <Cell
                        fill={color ?? `var(--color-${s.key})`}
                        key={`cell-${i + 1}`}
                     />
                  ))}
               </Bar>
            ))}
            <ChartTooltip
               content={
                  <ChartTooltipContent
                     formatter={tooltipFormatter}
                     labelFormatter={
                        xAxisFormatter
                           ? (label) => xAxisFormatter(String(label))
                           : undefined
                     }
                  />
               }
            />
            <ChartLegend content={<ChartLegendContent />} />
         </BarChart>
      </ChartContainer>
   );
});
