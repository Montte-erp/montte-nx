import { format, of } from "@f-o-t/money";
import type {
   BreakdownResult,
   InsightConfig,
   KpiResult,
   TimeSeriesConfig,
   TimeSeriesResult,
} from "@packages/analytics/types";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { useMemo } from "react";
import { orpc } from "@/integrations/orpc/client";
import { TrendsBarChart } from "../charts/trends-bar-chart";
import { TrendsLineChart } from "../charts/trends-line-chart";
import { TrendsNumberCard } from "../charts/trends-number-card";

interface InsightPreviewProps {
   config: InsightConfig;
}

export function InsightLoadingState() {
   return (
      <div className="space-y-4">
         <Skeleton className="h-4 w-1/3" />
         <Skeleton className="h-[200px] w-full" />
      </div>
   );
}

export function InsightErrorState({ error }: { error: Error }) {
   return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
         <AlertCircle className="size-5 text-destructive/60" />
         <p className="text-xs text-center">{error.message}</p>
      </div>
   );
}

function formatBRL(value: number): string {
   return format(of(value.toFixed(2), "BRL"), "pt-BR");
}

function isCurrencyAggregation(config: InsightConfig): boolean {
   return config.measure.aggregation !== "count";
}

function KpiPreview({
   data,
   formatAsCurrency,
}: {
   data: KpiResult;
   formatAsCurrency: boolean;
}) {
   const trend = data.comparison
      ? {
           value: Math.abs(data.comparison.percentageChange),
           direction: (data.comparison.percentageChange >= 0
              ? "up"
              : "down") as "up" | "down",
           comparison: "vs período anterior",
        }
      : undefined;

   return (
      <TrendsNumberCard
         formatAsCurrency={formatAsCurrency}
         label="Total"
         trend={trend}
         value={data.value}
      />
   );
}

function TimeSeriesPreview({
   config,
   data,
   valueFormatter,
}: {
   config: TimeSeriesConfig;
   data: TimeSeriesResult;
   valueFormatter?: (value: number) => string;
}) {
   const series = [{ key: "value", label: "Valor", color: "var(--chart-1)" }];

   const chartData = useMemo(
      () =>
         data.data.map((point) => ({ date: point.date, value: point.value })),
      [data.data],
   );

   const comparisonData = useMemo(
      () =>
         data.comparison?.data.map((point) => ({
            date: point.date,
            value: point.value,
         })),
      [data.comparison],
   );

   const xAxisFormatter = (value: string) =>
      new Date(value).toLocaleDateString("pt-BR", {
         day: "numeric",
         month: "short",
      });

   if (chartData.length === 0) {
      return (
         <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Sem dados para o período selecionado
         </div>
      );
   }

   if (config.chartType === "bar") {
      return (
         <TrendsBarChart
            comparisonData={comparisonData}
            data={chartData}
            series={series}
            valueFormatter={valueFormatter}
            xAxisFormatter={xAxisFormatter}
            xAxisKey="date"
         />
      );
   }

   return (
      <TrendsLineChart
         comparisonData={comparisonData}
         data={chartData}
         series={series}
         valueFormatter={valueFormatter}
         xAxisFormatter={xAxisFormatter}
         xAxisKey="date"
      />
   );
}

function BreakdownPreview({
   data,
   valueFormatter,
}: {
   data: BreakdownResult;
   valueFormatter?: (value: number) => string;
}) {
   const series = [{ key: "value", label: "Valor", color: "var(--chart-1)" }];

   const chartData = useMemo(
      () => data.data.map((item) => ({ label: item.label, value: item.value })),
      [data.data],
   );

   if (chartData.length === 0) {
      return (
         <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Sem dados para o período selecionado
         </div>
      );
   }

   return (
      <TrendsBarChart
         data={chartData}
         series={series}
         valueFormatter={valueFormatter}
         xAxisFormatter={(label) => label}
         xAxisKey="label"
      />
   );
}

export function InsightPreview({ config }: InsightPreviewProps) {
   const { data } = useSuspenseQuery(
      orpc.analytics.query.queryOptions({ input: { config } }),
   );

   const formatAsCurrency = isCurrencyAggregation(config);
   const valueFormatter = formatAsCurrency ? formatBRL : undefined;

   return (
      <div className="h-full">
         <div className="space-y-3">
            {config.type === "kpi" && (
               <KpiPreview
                  data={data as KpiResult}
                  formatAsCurrency={formatAsCurrency}
               />
            )}
            {config.type === "time_series" && (
               <TimeSeriesPreview
                  config={config}
                  data={data as TimeSeriesResult}
                  valueFormatter={valueFormatter}
               />
            )}
            {config.type === "breakdown" && (
               <BreakdownPreview
                  data={data as BreakdownResult}
                  valueFormatter={valueFormatter}
               />
            )}
         </div>
      </div>
   );
}
