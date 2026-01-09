import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";

interface BudgetProgressBarProps {
   spent: number;
   scheduled: number;
   available: number;
   total: number;
   percentage: number;
   forecastPercentage: number;
   showLabels?: boolean;
   className?: string;
}

function formatCurrency(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      currency: "BRL",
      style: "currency",
   }).format(value);
}

export function BudgetProgressBar({
   spent,
   scheduled,
   available,
   total,
   percentage,
   forecastPercentage,
   showLabels = true,
   className,
}: BudgetProgressBarProps) {
   const isOverBudget = percentage >= 100;
   const isNearLimit = percentage >= 80 && percentage < 100;

   const spentWidth = Math.min(percentage, 100);
   const scheduledWidth = Math.min(
      Math.max(0, forecastPercentage - percentage),
      100 - spentWidth,
   );

   return (
      <div className={cn("space-y-2", className)}>
         <Tooltip>
            <TooltipTrigger asChild>
               <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden cursor-pointer">
                  <div
                     className={cn(
                        "absolute left-0 top-0 h-full rounded-l-full transition-all",
                        isOverBudget
                           ? "bg-destructive"
                           : isNearLimit
                             ? "bg-yellow-500"
                             : "bg-primary",
                     )}
                     style={{ width: `${spentWidth}%` }}
                  />
                  {scheduledWidth > 0 && (
                     <div
                        className={cn(
                           "absolute top-0 h-full transition-all",
                           isOverBudget
                              ? "bg-destructive/40"
                              : isNearLimit
                                ? "bg-yellow-500/40"
                                : "bg-primary/40",
                        )}
                        style={{
                           left: `${spentWidth}%`,
                           width: `${scheduledWidth}%`,
                        }}
                     />
                  )}
               </div>
            </TooltipTrigger>
            <TooltipContent className="space-y-1">
               <p>
                  <span className="font-medium">
                     Gasto:
                  </span>{" "}
                  {formatCurrency(spent)} ({percentage.toFixed(1)}%)
               </p>
               {scheduled > 0 && (
                  <p>
                     <span className="font-medium">
                        Agendado:
                     </span>{" "}
                     {formatCurrency(scheduled)}
                  </p>
               )}
               <p>
                  <span className="font-medium">
                     Disponível:
                  </span>{" "}
                  {formatCurrency(available)}
               </p>
            </TooltipContent>
         </Tooltip>

         {showLabels && (
            <div className="flex justify-between text-xs text-muted-foreground">
               <span>
                  {formatCurrency(spent)} / {formatCurrency(total)}
               </span>
               <span
                  className={cn(
                     isOverBudget
                        ? "text-destructive font-medium"
                        : isNearLimit
                          ? "text-yellow-600 font-medium"
                          : "",
                  )}
               >
                  {percentage.toFixed(0)}%
               </span>
            </div>
         )}
      </div>
   );
}
