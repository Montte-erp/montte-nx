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
   ChartTooltip,
} from "@packages/ui/components/chart";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
   Cell,
   Label,
   Pie,
   PieChart,
   RadialBar,
   RadialBarChart,
} from "recharts";
import { useTRPC } from "@/integrations/clients";
import { GoalProgressBar } from "@/pages/goals/ui/goal-progress-bar";

type Goal = RouterOutput["goals"]["getById"];

type GoalProgressSectionProps = {
   goal: Goal;
};

interface ChartTooltipContentProps {
   active?: boolean;
   payload?: Array<{
      name: string;
      value: number;
      payload: { fill: string };
   }>;
}

function ChartTooltipContent({ active, payload }: ChartTooltipContentProps) {
   if (!active || !payload?.length) return null;

   return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
         <div className="space-y-1.5">
            {payload.map((entry, index) => (
               <div className="flex items-center gap-2" key={`tooltip-${index + 1}`}>
                  <div
                     className="h-3 w-3 rounded-sm"
                     style={{ backgroundColor: entry.payload.fill }}
                  />
                  <span className="text-sm text-muted-foreground">
                     {entry.name}:
                  </span>
                  <span className="text-sm font-medium">
                     {formatDecimalCurrency(entry.value)}
                  </span>
               </div>
            ))}
         </div>
      </div>
   );
}

function GoalProgressSkeleton() {
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

function GoalProgressContent({ goal }: GoalProgressSectionProps) {
   const trpc = useTRPC();

   const { data: progressData } = useSuspenseQuery(
      trpc.goals.getProgress.queryOptions({ id: goal.id }),
   );

   const targetAmount = Number(goal.targetAmount);
   const currentAmount = goal.currentAmount;
   const remaining = Math.max(0, targetAmount - currentAmount);
   const percentage =
      targetAmount > 0
         ? Math.min(100, Math.round((currentAmount / targetAmount) * 100))
         : 0;

   const chartData = [
      { name: "Acumulado", value: currentAmount, fill: "#10b981" },
      { name: "Restante", value: remaining, fill: "#e5e7eb" },
   ];

   const radialData = [
      {
         name: "Progresso",
         value: percentage,
         fill: percentage >= 100 ? "#10b981" : "#3b82f6",
      },
   ];

   const chartConfig: ChartConfig = {
      acumulado: {
         color: "#10b981",
         label: "Acumulado",
      },
      restante: {
         color: "#e5e7eb",
         label: "Restante",
      },
   };

   return (
      <Card className="flex flex-col">
         <CardHeader>
            <CardTitle>Progresso da Meta</CardTitle>
            <CardDescription>
               Acompanhe quanto falta para atingir sua meta
            </CardDescription>
         </CardHeader>
         <CardContent className="space-y-6">
            <div className="space-y-4">
               <GoalProgressBar
                  currentAmount={currentAmount}
                  size="lg"
                  targetAmount={targetAmount}
               />
               <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                     Acumulado: {formatDecimalCurrency(currentAmount)}
                  </span>
                  <span className="font-medium">
                     Meta: {formatDecimalCurrency(targetAmount)}
                  </span>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <h4 className="text-sm font-medium mb-4">
                     Distribuicao do Progresso
                  </h4>
                  <ChartContainer className="h-[200px]" config={chartConfig}>
                     <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                           cx="50%"
                           cy="50%"
                           data={chartData}
                           dataKey="value"
                           innerRadius={50}
                           nameKey="name"
                           outerRadius={80}
                           strokeWidth={2}
                        >
                           {chartData.map((entry, index) => (
                              <Cell
                                 fill={entry.fill}
                                 key={`cell-${index + 1}`}
                                 stroke={entry.fill}
                              />
                           ))}
                           <Label
                              content={({ viewBox }) => {
                                 if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                    return (
                                       <text
                                          dominantBaseline="middle"
                                          textAnchor="middle"
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                       >
                                          <tspan
                                             className="fill-foreground text-2xl font-bold"
                                             x={viewBox.cx}
                                             y={viewBox.cy}
                                          >
                                             {percentage}%
                                          </tspan>
                                          <tspan
                                             className="fill-muted-foreground text-xs"
                                             x={viewBox.cx}
                                             y={(viewBox.cy || 0) + 20}
                                          >
                                             completo
                                          </tspan>
                                       </text>
                                    );
                                 }
                                 return null;
                              }}
                           />
                        </Pie>
                     </PieChart>
                  </ChartContainer>
               </div>

               <div>
                  <h4 className="text-sm font-medium mb-4">Indicador de Meta</h4>
                  <ChartContainer className="h-[200px]" config={chartConfig}>
                     <RadialBarChart
                        cx="50%"
                        cy="50%"
                        data={radialData}
                        endAngle={-270}
                        innerRadius={60}
                        outerRadius={90}
                        startAngle={90}
                     >
                        <RadialBar
                           background
                           cornerRadius={10}
                           dataKey="value"
                        />
                        <Label
                           content={({ viewBox }) => {
                              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                 return (
                                    <text
                                       dominantBaseline="middle"
                                       textAnchor="middle"
                                       x={viewBox.cx}
                                       y={viewBox.cy}
                                    >
                                       <tspan
                                          className="fill-foreground text-3xl font-bold"
                                          x={viewBox.cx}
                                          y={viewBox.cy}
                                       >
                                          {percentage >= 100 ? "🎉" : `${percentage}%`}
                                       </tspan>
                                       {percentage >= 100 && (
                                          <tspan
                                             className="fill-muted-foreground text-xs"
                                             x={viewBox.cx}
                                             y={(viewBox.cy || 0) + 20}
                                          >
                                             Meta atingida!
                                          </tspan>
                                       )}
                                    </text>
                                 );
                              }
                              return null;
                           }}
                           position="center"
                        />
                     </RadialBarChart>
                  </ChartContainer>
               </div>
            </div>

            {progressData && (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="text-center">
                     <p className="text-2xl font-bold text-primary">
                        {formatDecimalCurrency(progressData.currentAmount)}
                     </p>
                     <p className="text-xs text-muted-foreground">Acumulado</p>
                  </div>
                  <div className="text-center">
                     <p className="text-2xl font-bold">
                        {formatDecimalCurrency(progressData.targetAmount)}
                     </p>
                     <p className="text-xs text-muted-foreground">Meta</p>
                  </div>
                  <div className="text-center">
                     <p className="text-2xl font-bold text-orange-500">
                        {formatDecimalCurrency(progressData.remainingAmount)}
                     </p>
                     <p className="text-xs text-muted-foreground">Faltam</p>
                  </div>
                  <div className="text-center">
                     <p className="text-2xl font-bold">
                        {progressData.daysRemaining !== null
                           ? `${progressData.daysRemaining}d`
                           : "-"}
                     </p>
                     <p className="text-xs text-muted-foreground">Dias restantes</p>
                  </div>
               </div>
            )}
         </CardContent>
      </Card>
   );
}

export function GoalProgressSection({ goal }: GoalProgressSectionProps) {
   return (
      <ErrorBoundary fallback={<GoalProgressSkeleton />}>
         <Suspense fallback={<GoalProgressSkeleton />}>
            <GoalProgressContent goal={goal} />
         </Suspense>
      </ErrorBoundary>
   );
}
