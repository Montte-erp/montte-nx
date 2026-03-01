import type { BudgetGoalWithProgress } from "@packages/database/repositories/budget-goals-repository";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Baby,
   Bell,
   BookOpen,
   Briefcase,
   Car,
   Coffee,
   CreditCard,
   Dumbbell,
   Fuel,
   Gift,
   Heart,
   Home,
   type LucideIcon,
   MoreHorizontal,
   Music,
   Package,
   Pencil,
   Plane,
   ShoppingCart,
   Smartphone,
   Target,
   Trash2,
   Utensils,
   Wallet,
   Zap,
} from "lucide-react";

const CATEGORY_ICONS: { name: string; Icon: LucideIcon }[] = [
   { name: "wallet", Icon: Wallet },
   { name: "credit-card", Icon: CreditCard },
   { name: "home", Icon: Home },
   { name: "car", Icon: Car },
   { name: "shopping-cart", Icon: ShoppingCart },
   { name: "utensils", Icon: Utensils },
   { name: "plane", Icon: Plane },
   { name: "heart", Icon: Heart },
   { name: "book-open", Icon: BookOpen },
   { name: "briefcase", Icon: Briefcase },
   { name: "package", Icon: Package },
   { name: "music", Icon: Music },
   { name: "coffee", Icon: Coffee },
   { name: "smartphone", Icon: Smartphone },
   { name: "dumbbell", Icon: Dumbbell },
   { name: "baby", Icon: Baby },
   { name: "gift", Icon: Gift },
   { name: "zap", Icon: Zap },
   { name: "fuel", Icon: Fuel },
];

const ICON_MAP = new Map(CATEGORY_ICONS.map(({ name, Icon }) => [name, Icon]));

const formatBRL = (value: number) =>
   new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
   }).format(value);

interface BudgetGoalCardProps {
   goal: BudgetGoalWithProgress;
   onEdit: (goal: BudgetGoalWithProgress) => void;
   onDelete: (goal: BudgetGoalWithProgress) => void;
}

export function BudgetGoalCard({
   goal,
   onEdit,
   onDelete,
}: BudgetGoalCardProps) {
   const Icon =
      (goal.categoryIcon ? ICON_MAP.get(goal.categoryIcon) : null) ?? Target;

   const progressColor =
      goal.percentUsed >= 100
         ? "bg-destructive"
         : goal.alertThreshold && goal.percentUsed >= goal.alertThreshold
           ? "bg-amber-500"
           : "bg-emerald-500";

   const accentColor = goal.categoryColor ?? "#6366f1";

   return (
      <div className="rounded-lg border bg-card p-4 space-y-3">
         {/* Header: icon + name + dropdown menu */}
         <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
               <div
                  className="size-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accentColor}20` }}
               >
                  <Icon className="size-4" style={{ color: accentColor }} />
               </div>
               <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                     {goal.subcategoryName ?? goal.categoryName ?? "—"}
                  </p>
                  {goal.subcategoryName && goal.categoryName && (
                     <p className="text-xs text-muted-foreground">
                        {goal.categoryName}
                     </p>
                  )}
               </div>
            </div>

            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <Button
                     className="size-8 shrink-0"
                     size="icon"
                     variant="ghost"
                  >
                     <MoreHorizontal className="size-4" />
                     <span className="sr-only">Ações</span>
                  </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(goal)}>
                     <Pencil className="size-4 mr-2" />
                     Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                     className="text-destructive focus:text-destructive"
                     onClick={() => onDelete(goal)}
                  >
                     <Trash2 className="size-4 mr-2" />
                     Excluir
                  </DropdownMenuItem>
               </DropdownMenuContent>
            </DropdownMenu>
         </div>

         {/* Amounts and progress */}
         <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
               <span className="text-muted-foreground">Gasto</span>
               <span
                  className={
                     goal.percentUsed >= 100
                        ? "text-destructive font-medium"
                        : ""
                  }
               >
                  {formatBRL(goal.spentAmount)} /{" "}
                  {formatBRL(Number(goal.limitAmount))}
               </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
               <div
                  className={`h-full rounded-full transition-all ${progressColor}`}
                  style={{ width: `${Math.min(goal.percentUsed, 100)}%` }}
               />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
               <span>{goal.percentUsed}% utilizado</span>
               {goal.alertThreshold && (
                  <span className="flex items-center gap-1">
                     <Bell className="size-3" />
                     {goal.alertThreshold}%
                  </span>
               )}
            </div>
         </div>
      </div>
   );
}
