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

function KpiPreview({ data }: { data: KpiResult }) {
  const trend = data.comparison
    ? {
        value: Math.abs(data.comparison.percentageChange),
        direction: (data.comparison.percentageChange >= 0 ? "up" : "down") as "up" | "down",
        comparison: "vs período anterior",
      }
    : undefined;

  return <TrendsNumberCard label="Total" trend={trend} value={data.value} />;
}

function TimeSeriesPreview({
  config,
  data,
}: {
  config: TimeSeriesConfig;
  data: TimeSeriesResult;
}) {
  const series = [{ key: "value", label: "Valor", color: "var(--chart-1)" }];

  const chartData = useMemo(
    () => data.data.map((point) => ({ date: point.date, value: point.value })),
    [data.data],
  );

  const comparisonData = useMemo(
    () => data.comparison?.data.map((point) => ({ date: point.date, value: point.value })),
    [data.comparison],
  );

  const xAxisFormatter = (value: string) =>
    new Date(value).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });

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
      xAxisFormatter={xAxisFormatter}
      xAxisKey="date"
    />
  );
}

function BreakdownPreview({ data }: { data: BreakdownResult }) {
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
      xAxisFormatter={(label) => label}
      xAxisKey="label"
    />
  );
}

export function InsightPreview({ config }: InsightPreviewProps) {
  const { data } = useSuspenseQuery(
    orpc.analytics.query.queryOptions({ input: { config } }),
  );

  return (
    <div className="h-full">
      <div className="space-y-3">
        {config.type === "kpi" && <KpiPreview data={data as KpiResult} />}
        {config.type === "time_series" && (
          <TimeSeriesPreview config={config} data={data as TimeSeriesResult} />
        )}
        {config.type === "breakdown" && <BreakdownPreview data={data as BreakdownResult} />}
      </div>
    </div>
  );
}
