import type { RouterOutput } from "@packages/api/client";
import { formatDecimalCurrency } from "@packages/money";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   type ChartConfig,
   ChartContainer,
   ChartLegend,
   ChartLegendContent,
   ChartTooltip,
} from "@packages/ui/components/chart";
import { Skeleton } from "@packages/ui/components/skeleton";
import { formatDate } from "@packages/utils/date";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
   CartesianGrid,
   Line,
   LineChart,
   ReferenceLine,
   XAxis,
   YAxis,
} from "recharts";
import { useTRPC } from "@/integrations/clients";

type Budget = RouterOutput["budgets"]["getById"];

interface BudgetProgressSectionProps {
   budget: Budget;
}

interface ChartTooltipContentProps {
   active?: boolean;
   payload?: Array<{
      dataKey: string;
      value: number;
      color: string;
   }>;
   label?: string;
   chartConfig: ChartConfig;
}

function ChartTooltipContent({
   active,
   payload,
   label,
   chartConfig,
}: ChartTooltipContentProps) {
   if (!active || !payload?.length) return null;

   return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
         <p className="text-sm font-medium mb-2">{label}</p>
         <div className="space-y-1.5">
            {payload.map((entry) => {
               const config = chartConfig[entry.dataKey];
               return (
                  <div className="flex items-center gap-2" key={entry.dataKey}>
                     <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                     />
                     <span className="text-sm text-muted-foreground">
                        {config?.label}:
                     </span>
                     <span className="text-sm font-medium">
                        {formatDecimalCurrency(entry.value)}
                     </span>
                  </div>
               );
            })}
         </div>
      </div>
   );
}

function BudgetProgressSkeleton() {
   return (
      <Card className="flex flex-col">
         <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
         </CardHeader>
         <CardContent>
            <Skeleton className="h-[300px] w-full" />
         </CardContent>
      </Card>
   );
}

function BudgetProgressContent({ budget }: BudgetProgressSectionProps) {
   const trpc = useTRPC();

   const { data: periods } = useSuspenseQuery(
      trpc.budgets.getPeriodHistory.queryOptions({
         budgetId: budget.id,
         limit: 12,
      }),
   );

   const { chartData, chartConfig } = useMemo(() => {
      const limitLabel = "Valor";
      const spentLabel = "Gasto";

      const sortedPeriods = [...periods].sort(
         (a, b) =>
            new Date(a.periodStart).getTime() -
            new Date(b.periodStart).getTime(),
      );

      const data = sortedPeriods.map((period) => ({
         date: formatDate(new Date(period.periodStart), "MMM/YY"),
         limit: parseFloat(period.totalAmount),
         spent: parseFloat(period.spentAmount || "0"),
      }));

      const config: ChartConfig = {
         limit: {
            color: "#3b82f6",
            label: limitLabel,
         },
         spent: {
            color: "#ef4444",
            label: spentLabel,
         },
      };

      return { chartConfig: config, chartData: data };
   }, [periods]);

   const hasData = chartData.length > 0;
   const currentLimit = parseFloat(budget.amount);

   return (
      <Card className="flex flex-col">
         <CardHeader>
            <CardTitle>Progresso do Período</CardTitle>
            <CardDescription>
               Acompanhe quanto foi gasto em relação ao limite definido
            </CardDescription>
         </CardHeader>
         <CardContent>
            {hasData ? (
               <ChartContainer
                  className="h-[300px] w-full"
                  config={chartConfig}
               >
                  <LineChart accessibilityLayer data={chartData}>
                     <CartesianGrid vertical={false} />
                     <XAxis
                        axisLine={false}
                        dataKey="date"
                        tickLine={false}
                        tickMargin={8}
                     />
                     <YAxis
                        axisLine={false}
                        tickFormatter={(value) => formatDecimalCurrency(value)}
                        tickLine={false}
                        tickMargin={8}
                     />
                     <ChartTooltip
                        content={
                           <ChartTooltipContent chartConfig={chartConfig} />
                        }
                     />
                     <ChartLegend content={<ChartLegendContent />} />
                     <ReferenceLine
                        stroke="#3b82f6"
                        strokeDasharray="5 5"
                        strokeWidth={1}
                        y={currentLimit}
                     />
                     <Line
                        dataKey="limit"
                        dot={false}
                        stroke="var(--color-limit)"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        type="monotone"
                     />
                     <Line
                        dataKey="spent"
                        dot
                        stroke="var(--color-spent)"
                        strokeWidth={2}
                        type="monotone"
                     />
                  </LineChart>
               </ChartContainer>
            ) : (
               <div className="flex h-[300px] items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                     Nenhum período encontrado para este orçamento
                  </p>
               </div>
            )}
         </CardContent>
      </Card>
   );
}

export function BudgetProgressSection({ budget }: BudgetProgressSectionProps) {
   return (
      <ErrorBoundary fallback={<BudgetProgressSkeleton />}>
         <Suspense fallback={<BudgetProgressSkeleton />}>
            <BudgetProgressContent budget={budget} />
         </Suspense>
      </ErrorBoundary>
   );
}
