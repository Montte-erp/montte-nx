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
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import {
   Bar,
   BarChart,
   CartesianGrid,
   Cell,
   Label,
   Pie,
   PieChart,
   XAxis,
   YAxis,
} from "recharts";
import { useTRPC } from "@/integrations/clients";

function CostCentersChartsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid gap-4 h-min">
         {createErrorFallback({
            errorDescription:
               "Falha ao carregar graficos de centros de custo. Por favor, tente novamente.",
            errorTitle: "Erro ao carregar graficos",
            retryText: "Tentar novamente",
         })(props)}
      </div>
   );
}

function CostCentersChartsSkeleton() {
   return (
      <div className="space-y-4">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((index) => (
               <Card key={`chart-skeleton-${index}`}>
                  <CardHeader>
                     <CardTitle>
                        <Skeleton className="h-6 w-32" />
                     </CardTitle>
                     <CardDescription>
                        <Skeleton className="h-4 w-48" />
                     </CardDescription>
                  </CardHeader>
                  <CardContent>
                     <Skeleton className="h-64 w-full" />
                  </CardContent>
               </Card>
            ))}
         </div>
      </div>
   );
}

interface CustomTooltipProps {
   active?: boolean;
   payload?: Array<{
      name: string;
      value: number;
      payload: {
         name: string;
         value: number;
         fill: string;
         transactions?: number;
      };
   }>;
   total?: number;
   valueFormatter?: (value: number) => string;
   showPercentage?: boolean;
   showTransactions?: boolean;
}

function CustomTooltip({
   active,
   payload,
   total,
   valueFormatter = formatDecimalCurrency,
   showPercentage = false,
   showTransactions = false,
}: CustomTooltipProps) {
   if (!active || !payload?.length) return null;

   return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
         <div className="space-y-1.5">
            {payload.map((entry) => {
               const percentage =
                  showPercentage && total
                     ? ((entry.value / total) * 100).toFixed(1)
                     : null;

               const displayName = entry.payload.name || entry.name;

               return (
                  <div className="flex items-center gap-2" key={displayName}>
                     <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: entry.payload.fill }}
                     />
                     <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                           {displayName}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                           <span>{valueFormatter(entry.value)}</span>
                           {percentage && <span>({percentage}%)</span>}
                           {showTransactions && entry.payload.transactions && (
                              <span>
                                 • {entry.payload.transactions} transacoes
                              </span>
                           )}
                        </div>
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
   );
}

const CHART_COLORS = [
   "#3b82f6",
   "#10b981",
   "#f59e0b",
   "#ef4444",
   "#8b5cf6",
   "#ec4899",
   "#06b6d4",
   "#84cc16",
   "#f97316",
   "#6366f1",
];

function CostCenterDistributionChart() {
   const trpc = useTRPC();
   const { data: costCenters } = useSuspenseQuery(
      trpc.costCenters.getAllPaginated.queryOptions({
         limit: 100,
         page: 1,
      }),
   );

   const { data: transactions } = useSuspenseQuery(
      trpc.transactions.getAllPaginated.queryOptions({
         limit: 100,
         page: 1,
      }),
   );

   const { chartData, chartConfig, hasData, total } = useMemo(() => {
      const costCenterMap = new Map<
         string,
         { name: string; total: number; count: number }
      >();

      for (const cc of costCenters.costCenters) {
         costCenterMap.set(cc.id, { count: 0, name: cc.name, total: 0 });
      }

      for (const t of transactions.transactions) {
         if (t.costCenterId && costCenterMap.has(t.costCenterId)) {
            const cc = costCenterMap.get(t.costCenterId);
            if (!cc) continue;
            cc.total += Math.abs(parseFloat(t.amount));
            cc.count += 1;
         }
      }

      const data = Array.from(costCenterMap.entries())
         .filter(([_, value]) => value.total > 0)
         .sort((a, b) => b[1].total - a[1].total)
         .slice(0, 10)
         .map(([_, value], index) => ({
            fill: CHART_COLORS[index % CHART_COLORS.length],
            name: value.name,
            transactions: value.count,
            value: value.total,
         }));

      const config: ChartConfig = {};
      let sum = 0;
      for (const item of data) {
         config[item.name] = {
            color: item.fill,
            label: item.name,
         };
         sum += item.value;
      }

      return {
         chartConfig: config,
         chartData: data,
         hasData: data.length > 0,
         total: sum,
      };
   }, [costCenters, transactions]);

   return (
      <Card className="flex flex-col">
         <CardHeader className="items-center pb-0">
            <CardTitle>Distribuicao por Centro de Custo</CardTitle>
            <CardDescription>
               Proporcao de gastos por centro de custo
            </CardDescription>
         </CardHeader>
         <CardContent className="flex-1 pb-0">
            {hasData ? (
               <ChartContainer
                  className="mx-auto aspect-square max-h-[300px]"
                  config={chartConfig}
               >
                  <PieChart>
                     <ChartTooltip
                        content={
                           <CustomTooltip
                              showPercentage
                              showTransactions
                              total={total}
                              valueFormatter={formatDecimalCurrency}
                           />
                        }
                        cursor={false}
                     />
                     <Pie
                        data={chartData}
                        dataKey="value"
                        innerRadius={60}
                        nameKey="name"
                        strokeWidth={5}
                     >
                        {chartData.map((entry) => (
                           <Cell fill={entry.fill} key={entry.name} />
                        ))}
                        <Label
                           content={({ viewBox }) => {
                              if (
                                 viewBox &&
                                 "cx" in viewBox &&
                                 "cy" in viewBox
                              ) {
                                 return (
                                    <text
                                       dominantBaseline="middle"
                                       textAnchor="middle"
                                       x={viewBox.cx}
                                       y={viewBox.cy}
                                    >
                                       <tspan
                                          className="fill-foreground text-xl font-bold"
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                       >
                                          {formatDecimalCurrency(total)}
                                       </tspan>
                                       <tspan
                                          className="fill-muted-foreground text-xs"
                                          x={viewBox.cx}
                                          y={(viewBox.cy || 0) + 20}
                                       >
                                          Total
                                       </tspan>
                                    </text>
                                 );
                              }
                           }}
                        />
                     </Pie>
                     <ChartLegend
                        className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                        content={<ChartLegendContent nameKey="name" />}
                     />
                  </PieChart>
               </ChartContainer>
            ) : (
               <div className="flex h-[300px] items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                     Nenhum dado disponivel
                  </p>
               </div>
            )}
         </CardContent>
      </Card>
   );
}

function TopCostCentersChart() {
   const trpc = useTRPC();
   const { data: costCenters } = useSuspenseQuery(
      trpc.costCenters.getAllPaginated.queryOptions({
         limit: 100,
         page: 1,
      }),
   );

   const { data: transactions } = useSuspenseQuery(
      trpc.transactions.getAllPaginated.queryOptions({
         limit: 100,
         page: 1,
      }),
   );

   const { chartData, chartConfig, hasData, total } = useMemo(() => {
      const costCenterMap = new Map<
         string,
         { name: string; total: number; count: number }
      >();

      for (const cc of costCenters.costCenters) {
         costCenterMap.set(cc.id, { count: 0, name: cc.name, total: 0 });
      }

      for (const t of transactions.transactions) {
         if (
            t.costCenterId &&
            costCenterMap.has(t.costCenterId) &&
            t.type === "expense"
         ) {
            const cc = costCenterMap.get(t.costCenterId);
            if (!cc) continue;
            cc.total += Math.abs(parseFloat(t.amount));
            cc.count += 1;
         }
      }

      const data = Array.from(costCenterMap.entries())
         .filter(([_, value]) => value.total > 0)
         .sort((a, b) => b[1].total - a[1].total)
         .slice(0, 5)
         .map(([_, value], index) => ({
            fill: CHART_COLORS[index % CHART_COLORS.length],
            name: value.name,
            transactions: value.count,
            value: value.total,
         }));

      const config: ChartConfig = {};
      let sum = 0;
      for (const item of data) {
         config[item.name] = {
            color: item.fill,
            label: item.name,
         };
         sum += item.value;
      }

      return {
         chartConfig: config,
         chartData: data,
         hasData: data.length > 0,
         total: sum,
      };
   }, [costCenters, transactions]);

   return (
      <Card>
         <CardHeader>
            <CardTitle>Top Centros de Custo</CardTitle>
            <CardDescription>
               Centros de custo com mais despesas
            </CardDescription>
         </CardHeader>
         <CardContent>
            {hasData ? (
               <ChartContainer
                  className="h-[250px] w-full"
                  config={chartConfig}
               >
                  <BarChart
                     accessibilityLayer
                     data={chartData}
                     layout="vertical"
                     margin={{ left: 0 }}
                  >
                     <CartesianGrid horizontal={false} />
                     <YAxis
                        axisLine={false}
                        dataKey="name"
                        tickLine={false}
                        tickMargin={8}
                        type="category"
                        width={100}
                     />
                     <XAxis
                        axisLine={false}
                        tickFormatter={(value) => `R$ ${value}`}
                        tickLine={false}
                        type="number"
                     />
                     <ChartTooltip
                        content={
                           <CustomTooltip
                              showPercentage
                              showTransactions
                              total={total}
                              valueFormatter={formatDecimalCurrency}
                           />
                        }
                        cursor={false}
                     />
                     <Bar dataKey="value" radius={4}>
                        {chartData.map((entry) => (
                           <Cell fill={entry.fill} key={entry.name} />
                        ))}
                     </Bar>
                  </BarChart>
               </ChartContainer>
            ) : (
               <div className="flex h-[250px] items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                     Nenhum dado disponivel
                  </p>
               </div>
            )}
         </CardContent>
      </Card>
   );
}

function CostCenterTypeDistributionChart() {
   const trpc = useTRPC();
   const { data: costCenters } = useSuspenseQuery(
      trpc.costCenters.getAllPaginated.queryOptions({
         limit: 100,
         page: 1,
      }),
   );

   const { data: transactions } = useSuspenseQuery(
      trpc.transactions.getAllPaginated.queryOptions({
         limit: 100,
         page: 1,
      }),
   );

   const { chartData, chartConfig, hasData, total } = useMemo(() => {
      let incomeSum = 0;
      let expenseSum = 0;

      const costCenterIds = new Set(costCenters.costCenters.map((cc) => cc.id));

      for (const t of transactions.transactions) {
         if (t.costCenterId && costCenterIds.has(t.costCenterId)) {
            const amount = Math.abs(parseFloat(t.amount));
            if (t.type === "income") {
               incomeSum += amount;
            } else if (t.type === "expense") {
               expenseSum += amount;
            }
         }
      }

      const incomeLabel = "Receita";
      const expensesLabel = "Despesas";

      const data = [
         {
            fill: "#10b981",
            name: incomeLabel,
            value: incomeSum,
         },
         {
            fill: "#ef4444",
            name: expensesLabel,
            value: expenseSum,
         },
      ].filter((item) => item.value > 0);

      const config: ChartConfig = {
         [incomeLabel]: {
            color: "#10b981",
            label: incomeLabel,
         },
         [expensesLabel]: {
            color: "#ef4444",
            label: expensesLabel,
         },
      };

      return {
         chartConfig: config,
         chartData: data,
         hasData: incomeSum > 0 || expenseSum > 0,
         total: incomeSum + expenseSum,
      };
   }, [costCenters, transactions]);

   return (
      <Card className="flex flex-col">
         <CardHeader className="items-center pb-0">
            <CardTitle>Distribuicao por Tipo</CardTitle>
            <CardDescription>
               Proporcao entre receitas e despesas
            </CardDescription>
         </CardHeader>
         <CardContent className="flex-1 pb-0">
            {hasData ? (
               <ChartContainer
                  className="mx-auto aspect-square max-h-[250px]"
                  config={chartConfig}
               >
                  <PieChart>
                     <ChartTooltip
                        content={
                           <CustomTooltip
                              showPercentage
                              total={total}
                              valueFormatter={formatDecimalCurrency}
                           />
                        }
                        cursor={false}
                     />
                     <Pie
                        data={chartData}
                        dataKey="value"
                        innerRadius={50}
                        nameKey="name"
                        strokeWidth={5}
                     >
                        {chartData.map((entry) => (
                           <Cell fill={entry.fill} key={entry.name} />
                        ))}
                        <Label
                           content={({ viewBox }) => {
                              if (
                                 viewBox &&
                                 "cx" in viewBox &&
                                 "cy" in viewBox
                              ) {
                                 return (
                                    <text
                                       dominantBaseline="middle"
                                       textAnchor="middle"
                                       x={viewBox.cx}
                                       y={viewBox.cy}
                                    >
                                       <tspan
                                          className="fill-foreground text-xl font-bold"
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                       >
                                          {formatDecimalCurrency(total)}
                                       </tspan>
                                       <tspan
                                          className="fill-muted-foreground text-xs"
                                          x={viewBox.cx}
                                          y={(viewBox.cy || 0) + 20}
                                       >
                                          Total
                                       </tspan>
                                    </text>
                                 );
                              }
                           }}
                        />
                     </Pie>
                     <ChartLegend
                        className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/3 [&>*]:justify-center"
                        content={<ChartLegendContent nameKey="name" />}
                     />
                  </PieChart>
               </ChartContainer>
            ) : (
               <div className="flex h-[250px] items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                     Nenhum dado disponivel
                  </p>
               </div>
            )}
         </CardContent>
      </Card>
   );
}

function CostCentersChartsContent() {
   return (
      <div className="space-y-4">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CostCenterDistributionChart />
            <CostCenterTypeDistributionChart />
         </div>
         <TopCostCentersChart />
      </div>
   );
}

export function CostCentersCharts() {
   return (
      <ErrorBoundary FallbackComponent={CostCentersChartsErrorFallback}>
         <Suspense fallback={<CostCentersChartsSkeleton />}>
            <CostCentersChartsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
