import { Badge } from "@packages/ui/components/badge";
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
   type: string | null;
   subcategories: { id: string; name: string; keywords: string[] | null }[];
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
            return (
               <div className="flex items-center gap-2 min-w-0">
                  {color || IconComponent ? (
                     <span
                        className="size-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: color ?? "#6366f1" }}
                     >
                        {IconComponent && (
                           <IconComponent className="size-3.5 text-white" />
                        )}
                     </span>
                  ) : null}
                  <span className="font-medium truncate">{name}</span>
                  {isDefault && <Badge variant="outline">Padrão</Badge>}
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
      {
         accessorKey: "keywords",
         header: "Palavras-chave",
         cell: ({ row }) => {
            const { keywords } = row.original;
            if (!keywords || keywords.length === 0)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <div className="flex flex-wrap gap-1">
                  {keywords.slice(0, 3).map((kw) => (
                     <Badge key={kw} variant="secondary">
                        {kw}
                     </Badge>
                  ))}
                  {keywords.length > 3 && (
                     <Badge variant="secondary">+{keywords.length - 3}</Badge>
                  )}
               </div>
            );
         },
      },
      {
         accessorKey: "subcategories",
         header: "Subcategorias",
         cell: ({ row }) => {
            const count = row.original.subcategories?.length ?? 0;
            if (count === 0)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <Badge variant="outline">
                  {count} {count === 1 ? "subcategoria" : "subcategorias"}
               </Badge>
            );
         },
      },
   ];
}
