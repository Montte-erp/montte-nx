import { Badge } from "@packages/ui/components/badge";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import {
   Baby,
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
   Music,
   Package,
   Plane,
   ShoppingCart,
   Smartphone,
   ShieldCheck,
   Utensils,
   Wallet,
   Zap,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
   wallet: Wallet,
   "credit-card": CreditCard,
   home: Home,
   car: Car,
   "shopping-cart": ShoppingCart,
   utensils: Utensils,
   plane: Plane,
   heart: Heart,
   "book-open": BookOpen,
   briefcase: Briefcase,
   package: Package,
   music: Music,
   coffee: Coffee,
   smartphone: Smartphone,
   dumbbell: Dumbbell,
   baby: Baby,
   gift: Gift,
   zap: Zap,
   fuel: Fuel,
};

export type CategoryRow = {
   id: string;
   name: string;
   isDefault: boolean;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   type: "income" | "expense" | null;
   parentId: string | null;
   subcategories?: CategoryRow[];
   createdAt: string | Date;
};

export function buildCategoryColumns(): ColumnDef<CategoryRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => {
            const { name, color, icon, isDefault } = row.original;
            const IconComponent = icon ? ICON_MAP[icon] : null;

            if (row.depth === 0 && (color || IconComponent)) {
               return (
                  <Announcement>
                     <AnnouncementTag>
                        {IconComponent && (
                           <IconComponent
                              className="size-4"
                              style={{ color: color ?? undefined }}
                           />
                        )}
                     </AnnouncementTag>
                     <AnnouncementTitle>
                        {name}
                        {isDefault && (
                           <Tooltip>
                              <TooltipTrigger asChild>
                                 <ShieldCheck className="size-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>Padrão</TooltipContent>
                           </Tooltip>
                        )}
                     </AnnouncementTitle>
                  </Announcement>
               );
            }

            return (
               <div className="flex items-center gap-2 min-w-0">
                  <span
                     className={
                        row.depth > 0 ? "truncate" : "font-medium truncate"
                     }
                  >
                     {name}
                  </span>
                  {isDefault && row.depth === 0 && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <Star className="size-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Padrão</TooltipContent>
                     </Tooltip>
                  )}
               </div>
            );
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         cell: ({ row }) => {
            const { type } = row.original;
            if (type === "income")
               return (
                  <Badge
                     className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-500"
                     variant="outline"
                  >
                     Receita
                  </Badge>
               );
            if (type === "expense")
               return <Badge variant="destructive">Despesa</Badge>;
            return <span className="text-sm text-muted-foreground">—</span>;
         },
      },
   ];
}
