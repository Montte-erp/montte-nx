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
   Area,
   AreaChart,
   CartesianGrid,
   Cell,
   Label,
   Pie,
   PieChart,
   XAxis,
   YAxis,
} from "recharts";
import { useTRPC } from "@/integrations/clients";

function BankAccountChartsErrorFallback() {
   return (
      <div className="p-4 text-center text-sm text-destructive">
         Falha ao carregar gráficos da conta bancária. Tente novamente mais
         tarde.
      </div>
   );
}

function BankAccountChartsSkeleton() {
   return (
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
      };
   }>;
   total?: number;
   valueFormatter?: (value: number) => string;
   showPercentage?: boolean;
}

function CustomTooltip({
   active,
   payload,
   total,
   valueFormatter = formatDecimalCurrency,
   showPercentage = false,
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
                        </div>
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
   );
}

interface MonthlyTooltipProps {
   active?: boolean;
   payload?: Array<{
      name: string;
      value: number;
      color: string;
      dataKey: string;
   }>;
   label?: string;
   chartConfig: ChartConfig;
}

function MonthlyTooltip({
   active,
   payload,
   label,
   chartConfig,
}: MonthlyTooltipProps) {
   if (!active || !payload?.length) return null;

   return (
      <div className="rounded-lg border bg-background p-3 shadow-md min-w-[180px]">
         <p className="mb-2 font-medium text-foreground capitalize">{label}</p>
         <div className="space-y-1.5">
            {payload.map((entry) => {
               const config = chartConfig[entry.dataKey];

               return (
                  <div
                     className="flex items-center justify-between gap-3"
                     key={entry.dataKey}
                  >
                     <div className="flex items-center gap-2">
                        <div
                           className="h-3 w-3 rounded-sm"
                           style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm text-muted-foreground">
                           {config?.label || entry.name}
                        </span>
                     </div>
                     <span className="text-sm font-medium text-foreground">
                        {formatDecimalCurrency(entry.value)}
                     </span>
                  </div>
               );
            })}
         </div>
      </div>
   );
}

type ChartGranularity = "daily" | "monthly";

interface ChartProps {
   bankAccountId: string;
   startDate?: Date | null;
   endDate?: Date | null;
   granularity?: ChartGranularity;
}

function BankAccountTypeDistributionChart({
   bankAccountId,
   startDate,
   endDate,
}: ChartProps) {
   const trpc = useTRPC();

   const { data } = useSuspenseQuery(
      trpc.bankAccounts.getTransactions.queryOptions({
         endDate: endDate?.toISOString(),
         id: bankAccountId,
         limit: 100,
         page: 1,
         startDate: startDate?.toISOString(),
      }),
   );

   const { chartData, chartConfig, hasData, total } = useMemo(() => {
      const transactions = data.transactions;

      let incomeSum = 0;
      let expenseSum = 0;

      for (const t of transactions) {
         const amount = Math.abs(parseFloat(t.amount));
         if (t.type === "income") {
            incomeSum += amount;
         } else if (t.type === "expense") {
            expenseSum += amount;
         }
      }

      const incomeLabel = "Receita";
      const expensesLabel = "Despesas";

      const chartData = [
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
         chartData,
         hasData: incomeSum > 0 || expenseSum > 0,
         total: incomeSum + expenseSum,
      };
   }, [data.transactions]);

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
                     Nenhuma transacao encontrada
                  </p>
               </div>
            )}
         </CardContent>
      </Card>
   );
}

function BankAccountEvolutionChart({
   bankAccountId,
   startDate,
   endDate,
   granularity = "daily",
}: ChartProps) {
   const trpc = useTRPC();

   const { data } = useSuspenseQuery(
      trpc.bankAccounts.getTransactions.queryOptions({
         endDate: endDate?.toISOString(),
         id: bankAccountId,
         limit: 100,
         page: 1,
         startDate: startDate?.toISOString(),
      }),
   );

   const { chartData, chartConfig, hasData, chartTitle, chartDescription } =
      useMemo(() => {
         const transactions = data.transactions;

         if (transactions.length === 0) {
            return {
               chartConfig: {},
               chartData: [],
               chartDescription: "",
               chartTitle: "",
               hasData: false,
            };
         }

         const incomeLabel = "Receita";
         const expensesLabel = "Despesas";

         if (granularity === "monthly") {
            const monthlyData = new Map<
               string,
               { income: number; expense: number; label: string }
            >();

            for (const t of transactions) {
               const date = new Date(t.date);
               const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
               const monthLabel = formatDate(date, "MMM yyyy");

               if (!monthlyData.has(monthKey)) {
                  monthlyData.set(monthKey, {
                     expense: 0,
                     income: 0,
                     label: monthLabel,
                  });
               }

               const monthData = monthlyData.get(monthKey);
               if (!monthData) continue;
               const amount = Math.abs(parseFloat(t.amount));

               if (t.type === "income") {
                  monthData.income += amount;
               } else if (t.type === "expense") {
                  monthData.expense += amount;
               }
            }

            const sortedData = Array.from(monthlyData.entries())
               .sort(([a], [b]) => a.localeCompare(b))
               .slice(-12);

            const chartData = sortedData.map(([_, d]) => d);

            const config: ChartConfig = {
               expense: {
                  color: "#ef4444",
                  label: expensesLabel,
               },
               income: {
                  color: "#10b981",
                  label: incomeLabel,
               },
            };

            return {
               chartConfig: config,
               chartData,
               chartDescription: "Historico de transacoes por mes",
               chartTitle: "Evolucao Mensal",
               hasData: chartData.length > 0,
            };
         }

         const dailyData = new Map<
            string,
            { income: number; expense: number; label: string }
         >();

         for (const t of transactions) {
            const date = new Date(t.date);
            const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            const dayLabel = formatDate(date, "dd/MM");

            if (!dailyData.has(dayKey)) {
               dailyData.set(dayKey, {
                  expense: 0,
                  income: 0,
                  label: dayLabel,
               });
            }

            const dayData = dailyData.get(dayKey);
            if (!dayData) continue;
            const amount = Math.abs(parseFloat(t.amount));

            if (t.type === "income") {
               dayData.income += amount;
            } else if (t.type === "expense") {
               dayData.expense += amount;
            }
         }

         const sortedData = Array.from(dailyData.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-31);

         const chartData = sortedData.map(([_, d]) => d);

         const config: ChartConfig = {
            expense: {
               color: "#ef4444",
               label: expensesLabel,
            },
            income: {
               color: "#10b981",
               label: incomeLabel,
            },
         };

         return {
            chartConfig: config,
            chartData,
            chartDescription: "Historico de transacoes por dia",
            chartTitle: "Evolucao Diaria",
            hasData: chartData.length > 0,
         };
      }, [data.transactions, granularity]);

   return (
      <Card>
         <CardHeader>
            <CardTitle>{chartTitle || "Evolucao"}</CardTitle>
            <CardDescription>
               {chartDescription || "Historico de transacoes"}
            </CardDescription>
         </CardHeader>
         <CardContent>
            {hasData ? (
               <ChartContainer
                  className="h-[250px] w-full"
                  config={chartConfig}
               >
                  <AreaChart accessibilityLayer data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis
                        axisLine={false}
                        dataKey="label"
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
                        content={<MonthlyTooltip chartConfig={chartConfig} />}
                     />
                     <ChartLegend content={<ChartLegendContent />} />
                     <Area
                        dataKey="income"
                        fill="var(--color-income)"
                        fillOpacity={0.3}
                        stackId="a"
                        stroke="var(--color-income)"
                        type="monotone"
                     />
                     <Area
                        dataKey="expense"
                        fill="var(--color-expense)"
                        fillOpacity={0.3}
                        stackId="b"
                        stroke="var(--color-expense)"
                        type="monotone"
                     />
                  </AreaChart>
               </ChartContainer>
            ) : (
               <div className="flex h-[250px] items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                     Nenhuma transacao encontrada
                  </p>
               </div>
            )}
         </CardContent>
      </Card>
   );
}

function BankAccountChartsContent({
   bankAccountId,
   startDate,
   endDate,
   granularity,
}: ChartProps) {
   return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <BankAccountEvolutionChart
            bankAccountId={bankAccountId}
            endDate={endDate}
            granularity={granularity}
            startDate={startDate}
         />
         <BankAccountTypeDistributionChart
            bankAccountId={bankAccountId}
            endDate={endDate}
            startDate={startDate}
         />
      </div>
   );
}

export function BankAccountCharts({
   bankAccountId,
   startDate,
   endDate,
   granularity = "daily",
}: {
   bankAccountId: string;
   startDate: Date | null;
   endDate: Date | null;
   granularity?: ChartGranularity;
}) {
   return (
      <ErrorBoundary FallbackComponent={BankAccountChartsErrorFallback}>
         <Suspense fallback={<BankAccountChartsSkeleton />}>
            <BankAccountChartsContent
               bankAccountId={bankAccountId}
               endDate={endDate}
               granularity={granularity}
               startDate={startDate}
            />
         </Suspense>
      </ErrorBoundary>
   );
}
