import dayjs from "dayjs";
import {
   type ChartConfig,
   ChartContainer,
   ChartLegend,
   ChartLegendContent,
   ChartTooltip,
   ChartTooltipContent,
} from "@packages/ui/components/chart";
import {
   Area,
   AreaChart,
   CartesianGrid,
   Line,
   LineChart,
   XAxis,
   YAxis,
} from "recharts";

// ============================================
// Constants
// ============================================

const CATEGORY_LABELS: Record<string, string> = {
   content: "Conteudo",
   ai: "Inteligencia Artificial",
   form: "Formularios",
   seo: "SEO",
   experiment: "Experimentos",
   webhook: "Webhooks",
   system: "Sistema",
};

const CHART_COLORS: Record<string, string> = {
   content: "#3b82f6",
   ai: "#8b5cf6",
   form: "#f59e0b",
   seo: "#10b981",
   experiment: "#f43f5e",
   webhook: "#06b6d4",
   system: "#64748b",
};

// ============================================
// Helpers
// ============================================

function generateEmptyDateRange(days: number): string[] {
   const now = dayjs();
   return Array.from({ length: days }, (_, i) =>
      now.subtract(days - 1 - i, "day").format("YYYY-MM-DD"),
   );
}

function buildChartConfig(): ChartConfig {
   const config: ChartConfig = {};
   for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
      config[key] = {
         label,
         color: CHART_COLORS[key] ?? "#94a3b8",
      };
   }
   return config;
}

const chartConfig = buildChartConfig();

// ============================================
// Types
// ============================================

interface UsageChartProps {
   data: Array<{
      date: string;
      total: number;
      byCategory: Record<string, number>;
   }>;
   mode?: "cost" | "count";
}

// ============================================
// UsageChart Component
// ============================================

export function UsageChart({ data, mode = "cost" }: UsageChartProps) {
   const categories = Object.keys(CATEGORY_LABELS);

   const effectiveData =
      data.length > 0
         ? data
         : generateEmptyDateRange(30).map((date) => ({
              date,
              total: 0,
              byCategory: {} as Record<string, number>,
           }));

   const chartData = effectiveData.map((d) => {
      const row: Record<string, number | string> = {
         date: new Date(d.date).toLocaleDateString("pt-BR", {
            day: "numeric",
            month: "short",
         }),
         total: d.total,
      };
      for (const cat of categories) {
         row[cat] = d.byCategory[cat] ?? 0;
      }
      return row;
   });

   const isCost = mode === "cost";

   const formatTick = (value: number) =>
      isCost ? `R$ ${value.toFixed(0)}` : value.toLocaleString("pt-BR");

   if (isCost) {
      return (
         <ChartContainer className="h-[350px] w-full" config={chartConfig}>
            <AreaChart
               accessibilityLayer
               data={chartData}
               margin={{ left: 12, right: 12 }}
            >
               <CartesianGrid vertical={false} />
               <XAxis
                  axisLine={false}
                  dataKey="date"
                  tickLine={false}
                  tickMargin={8}
               />
               <YAxis
                  axisLine={false}
                  tickFormatter={formatTick}
                  tickLine={false}
               />
               <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
               <ChartLegend content={<ChartLegendContent />} />
               {categories.map((cat) => (
                  <Area
                     dataKey={cat}
                     fill={`var(--color-${cat})`}
                     fillOpacity={0.1}
                     key={cat}
                     stroke={`var(--color-${cat})`}
                     strokeWidth={2}
                     type="monotone"
                  />
               ))}
            </AreaChart>
         </ChartContainer>
      );
   }

   return (
      <ChartContainer className="h-[350px] w-full" config={chartConfig}>
         <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12 }}
         >
            <CartesianGrid vertical={false} />
            <XAxis
               axisLine={false}
               dataKey="date"
               tickLine={false}
               tickMargin={8}
            />
            <YAxis
               axisLine={false}
               tickFormatter={formatTick}
               tickLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
            <ChartLegend content={<ChartLegendContent />} />
            {categories.map((cat) => (
               <Line
                  dataKey={cat}
                  dot={false}
                  key={cat}
                  stroke={`var(--color-${cat})`}
                  strokeWidth={2}
                  type="monotone"
               />
            ))}
         </LineChart>
      </ChartContainer>
   );
}
