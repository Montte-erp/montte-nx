import { Badge } from "@packages/ui/components/badge";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";
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
   Star,
   Tags,
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
   isArchived: boolean;
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
            const { name, color, icon, isDefault, keywords } = row.original;
            const IconComponent = icon ? ICON_MAP[icon] : null;
            const hasKeywords = keywords && keywords.length > 0;

            const keywordsTooltip = hasKeywords ? (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <Tags className="size-4 text-muted-foreground shrink-0 cursor-default" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">
                     <p className="font-semibold text-sm">Palavras-chave IA</p>
                     <p className="text-xs text-muted-foreground mb-1">
                        Geradas automaticamente com base no nome e descrição da
                        categoria.
                     </p>
                     <p className="text-xs">{keywords!.join(", ")}</p>
                  </TooltipContent>
               </Tooltip>
            ) : null;

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
                        {row.original.isArchived && (
                           <Badge
                              variant="secondary"
                              className="text-xs shrink-0 opacity-70 pointer-events-none"
                           >
                              Arquivada
                           </Badge>
                        )}
                        {isDefault && (
                           <Tooltip>
                              <TooltipTrigger asChild>
                                 <ShieldCheck className="size-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>Padrão</TooltipContent>
                           </Tooltip>
                        )}
                        {keywordsTooltip}
                     </AnnouncementTitle>
                  </Announcement>
               );
            }

            return (
               <div className="flex items-center gap-2 min-w-0">
                  {row.depth > 0 && (
                     <div className="flex items-center gap-2 pl-2 border-l-2 border-muted-foreground/20">
                        <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                     </div>
                  )}
                  <span
                     className={
                        row.depth > 0
                           ? "truncate text-muted-foreground"
                           : "font-medium truncate"
                     }
                  >
                     {name}
                  </span>
                  {row.original.isArchived && (
                     <Badge
                        variant="secondary"
                        className="text-xs shrink-0 opacity-70 pointer-events-none"
                     >
                        Arquivada
                     </Badge>
                  )}
                  {isDefault && row.depth === 0 && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <Star className="size-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Padrão</TooltipContent>
                     </Tooltip>
                  )}
                  {keywordsTooltip}
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
         id: "subcategories",
         header: "Subcategorias",
         cell: ({ row }) => {
            if (row.depth > 0) return null;
            const count = row.original.subcategories?.length ?? 0;
            if (count === 0)
               return <span className="text-sm text-muted-foreground">—</span>;
            return <Badge variant="secondary">{count}</Badge>;
         },
      },
      {
         id: "keywords",
         header: "Palavras-chave",
         cell: ({ row }) => {
            const keywords = row.original.keywords;
            const count = keywords?.length ?? 0;
            if (count === 0)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <Announcement className="cursor-default w-fit">
                        <AnnouncementTag>
                           <Tags className="size-3" />
                        </AnnouncementTag>
                        <AnnouncementTitle className="text-xs">
                           {count} {count === 1 ? "palavra" : "palavras"}
                        </AnnouncementTitle>
                     </Announcement>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">
                     <p className="font-semibold text-sm">Palavras-chave IA</p>
                     <p className="text-xs text-muted-foreground mb-1">
                        Geradas automaticamente com base no nome e descrição da
                        categoria.
                     </p>
                     <p className="text-xs">{keywords!.join(", ")}</p>
                  </TooltipContent>
               </Tooltip>
            );
         },
      },
   ];
}
