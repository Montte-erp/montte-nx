import type { RouterOutput } from "@packages/api/client";
import { StatsCard } from "@packages/ui/components/stats-card";

type Budget = RouterOutput["budgets"]["getById"];

interface BudgetDetailsStatsProps {
   budget: Budget;
}

function formatCurrency(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      currency: "BRL",
      style: "currency",
   }).format(value);
}

export function BudgetDetailsStats({ budget }: BudgetDetailsStatsProps) {
   const { progress, currentPeriod } = budget;

   const percentage = progress.percentage;
   const forecastPercentage = progress.forecastPercentage;
   const available = progress.available;

   const periodLabels: Record<string, string> = {
      custom: "Personalizado",
      daily: "Diário",
      monthly: "Mensal",
      quarterly: "Trimestral",
      weekly: "Semanal",
      yearly: "Anual",
   };

   const daysRemaining = currentPeriod
      ? Math.ceil(
           (new Date(currentPeriod.periodEnd).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
        )
      : 0;

   const dailyBudget = daysRemaining > 0 ? available / daysRemaining : 0;

   const isOverBudget = percentage >= 100;
   const isNearLimit = percentage >= 80 && percentage < 100;

   const utilizationDescription = isOverBudget
      ? "Acima do limite"
      : isNearLimit
        ? "Próximos do limite"
        : "No caminho certo";

   const periodLabel = periodLabels[budget.periodType as string] || "Mensal";

   return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <StatsCard
            description={utilizationDescription}
            title="Utilização média"
            value={`${percentage.toFixed(1)}%`}
         />
         <StatsCard
            description={periodLabel}
            title="Dias restantes"
            value={Math.max(0, daysRemaining)}
         />
         <StatsCard
            description="por dia disponível"
            title="Orçamento diário"
            value={formatCurrency(dailyBudget)}
         />
         <StatsCard
            description="incluindo agendados"
            title="Previsão"
            value={`${forecastPercentage.toFixed(1)}%`}
         />
      </div>
   );
}
