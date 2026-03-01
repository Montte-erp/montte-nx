import type { BudgetGoalWithProgress } from "@packages/database/repositories/budget-goals-repository";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
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

export type { BudgetGoalWithProgress };

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

function formatBRL(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
   }).format(value);
}

export function buildBudgetGoalColumns(
   onEdit: (goal: BudgetGoalWithProgress) => void,
   onDelete: (goal: BudgetGoalWithProgress) => void,
): ColumnDef<BudgetGoalWithProgress>[] {
   return [
      {
         id: "categoria",
         header: "Categoria",
         cell: ({ row }) => {
            const goal = row.original;
            const Icon =
               (goal.categoryIcon ? ICON_MAP.get(goal.categoryIcon) : null) ??
               Target;
            const accentColor = goal.categoryColor ?? "#6366f1";
            const displayName = goal.subcategoryName
               ? `${goal.subcategoryName} (${goal.categoryName})`
               : (goal.categoryName ?? "—");

            return (
               <div className="flex items-center gap-2 min-w-0">
                  <div
                     className="size-6 rounded-md flex items-center justify-center shrink-0"
                     style={{ backgroundColor: `${accentColor}20` }}
                  >
                     <Icon
                        className="size-3.5"
                        style={{ color: accentColor }}
                     />
                  </div>
                  <span className="text-sm font-medium truncate">
                     {displayName}
                  </span>
               </div>
            );
         },
      },
      {
         accessorKey: "limitAmount",
         header: "Limite",
         cell: ({ row }) => (
            <span className="text-sm tabular-nums">
               {formatBRL(Number(row.original.limitAmount))}
            </span>
         ),
      },
      {
         accessorKey: "spentAmount",
         header: "Gasto",
         cell: ({ row }) => {
            const goal = row.original;
            return (
               <span
                  className={`text-sm tabular-nums ${
                     goal.percentUsed >= 100
                        ? "text-destructive font-medium"
                        : ""
                  }`}
               >
                  {formatBRL(goal.spentAmount)}
               </span>
            );
         },
      },
      {
         id: "utilizado",
         header: "Utilizado",
         cell: ({ row }) => {
            const goal = row.original;
            const isOver = goal.percentUsed >= 100;
            const isNearAlert =
               !isOver &&
               goal.alertThreshold != null &&
               goal.percentUsed >= goal.alertThreshold;

            if (isOver) {
               return <Badge variant="destructive">{goal.percentUsed}%</Badge>;
            }

            if (isNearAlert) {
               return (
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20">
                     {goal.percentUsed}%
                  </Badge>
               );
            }

            return <Badge variant="secondary">{goal.percentUsed}%</Badge>;
         },
      },
      {
         id: "alerta",
         header: "Alerta",
         cell: ({ row }) => {
            const goal = row.original;
            if (!goal.alertThreshold) {
               return <span className="text-sm text-muted-foreground">—</span>;
            }
            return (
               <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Bell className="size-3.5" />
                  {goal.alertThreshold}%
               </span>
            );
         },
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper for table row click
            <div
               className="flex items-center justify-end gap-1"
               onClick={(e) => e.stopPropagation()}
               onKeyDown={(e) => e.stopPropagation()}
            >
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button size="icon" variant="ghost">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Ações</span>
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                     <DropdownMenuItem onClick={() => onEdit(row.original)}>
                        <Pencil className="size-4 mr-2" />
                        Editar
                     </DropdownMenuItem>
                     <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(row.original)}
                     >
                        <Trash2 className="size-4 mr-2" />
                        Excluir
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
         ),
      },
   ];
}
