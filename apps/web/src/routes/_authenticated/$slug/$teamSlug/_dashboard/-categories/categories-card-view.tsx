import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Item,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import {
   Archive,
   ArchiveRestore,
   Baby,
   BookOpen,
   Briefcase,
   Car,
   ChevronRight,
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
   Pencil,
   Plane,
   Plus,
   ShoppingCart,
   Smartphone,
   Star,
   Trash2,
   Utensils,
   Wallet,
   Zap,
} from "lucide-react";
import type { CategoryRow } from "./categories-columns";

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
   star: Star,
};

interface CategoriesCardViewProps {
   categories: CategoryRow[];
   onEdit: (category: CategoryRow) => void;
   onDelete: (category: CategoryRow) => void;
   onArchive: (category: CategoryRow) => void;
   onUnarchive: (category: CategoryRow) => void;
   onAddSubcategory: (category: CategoryRow) => void;
}

export function CategoriesCardView({
   categories,
   onEdit,
   onDelete,
   onArchive,
   onUnarchive,
   onAddSubcategory,
}: CategoriesCardViewProps) {
   return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         {categories.map((cat) => {
            const subCount = cat.subcategories?.length ?? 0;
            const hasSubs = subCount > 0;
            const IconComponent = cat.icon ? ICON_MAP[cat.icon] : null;
            const accentColor = cat.color ?? "#94a3b8";

            return (
               <div
                  className={`rounded-xl border overflow-hidden flex flex-col shadow-sm transition-shadow duration-200 hover:shadow-md${cat.isArchived ? " opacity-60" : ""}`}
                  key={cat.id}
               >
                  {/* Accent strip — category color identity */}
                  <div
                     className="h-1 shrink-0"
                     style={{ backgroundColor: accentColor }}
                  />

                  {/* Header */}
                  <Item>
                     <ItemMedia
                        className="size-10 rounded-lg font-bold text-white text-sm"
                        style={{
                           backgroundColor: accentColor,
                           boxShadow: `0 2px 8px ${accentColor}50`,
                        }}
                     >
                        {hasSubs ? (
                           <span>{subCount}</span>
                        ) : IconComponent ? (
                           <IconComponent
                              aria-hidden="true"
                              className="size-4"
                           />
                        ) : (
                           <span>–</span>
                        )}
                     </ItemMedia>

                     <ItemContent>
                        <ItemTitle className="font-semibold">
                           {cat.name}
                        </ItemTitle>
                        {cat.description && (
                           <ItemDescription>{cat.description}</ItemDescription>
                        )}
                     </ItemContent>

                     {cat.type && (
                        <Badge
                           className={
                              cat.type === "income"
                                 ? "border-green-600 text-green-600 dark:border-green-500 dark:text-green-500 shrink-0"
                                 : "shrink-0"
                           }
                           variant={
                              cat.type === "income" ? "outline" : "destructive"
                           }
                        >
                           {cat.type === "income" ? "Receita" : "Despesa"}
                        </Badge>
                     )}
                  </Item>

                  {/* Subcategories */}
                  {hasSubs && (
                     <>
                        <ItemSeparator />
                        <ItemGroup className="divide-y flex-1">
                           {cat.subcategories!.map((sub) => (
                              <Item
                                 className="rounded-none bg-muted/30"
                                 key={sub.id}
                                 size="sm"
                              >
                                 <ItemMedia
                                    className="size-8 rounded-md border"
                                    style={{
                                       backgroundColor: `${accentColor}18`,
                                       borderColor: `${accentColor}30`,
                                    }}
                                 >
                                    {IconComponent && (
                                       <IconComponent
                                          aria-hidden="true"
                                          className="size-4"
                                          style={{ color: accentColor }}
                                       />
                                    )}
                                 </ItemMedia>

                                 <ItemContent>
                                    <ItemTitle className="font-normal text-muted-foreground">
                                       {sub.name}
                                    </ItemTitle>
                                 </ItemContent>

                                 <ChevronRight
                                    aria-hidden="true"
                                    className="size-4 text-muted-foreground/30 shrink-0"
                                 />
                              </Item>
                           ))}
                        </ItemGroup>
                     </>
                  )}

                  {/* Actions */}
                  {!cat.isDefault && (
                     <>
                        <ItemSeparator />
                        <Item size="sm">
                           {cat.isArchived ? (
                              <>
                                 <Button
                                    onClick={() => onUnarchive(cat)}
                                    size="sm"
                                    tooltip="Desarquivar"
                                    variant="ghost"
                                 >
                                    <ArchiveRestore />
                                 </Button>
                                 <div className="flex-1" />
                                 <Button
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => onDelete(cat)}
                                    size="sm"
                                    tooltip="Excluir"
                                    variant="ghost"
                                 >
                                    <Trash2 />
                                 </Button>
                              </>
                           ) : (
                              <>
                                 <Button
                                    onClick={() => onAddSubcategory(cat)}
                                    size="sm"
                                    tooltip="Nova subcategoria"
                                    variant="ghost"
                                 >
                                    <Plus />
                                 </Button>
                                 <Button
                                    onClick={() => onEdit(cat)}
                                    size="sm"
                                    tooltip="Editar"
                                    variant="ghost"
                                 >
                                    <Pencil />
                                 </Button>
                                 <Button
                                    onClick={() => onArchive(cat)}
                                    size="sm"
                                    tooltip="Arquivar"
                                    variant="ghost"
                                 >
                                    <Archive />
                                 </Button>
                                 <div className="flex-1" />
                                 <Button
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => onDelete(cat)}
                                    size="sm"
                                    tooltip="Excluir"
                                    variant="ghost"
                                 >
                                    <Trash2 />
                                 </Button>
                              </>
                           )}
                        </Item>
                     </>
                  )}
               </div>
            );
         })}
      </div>
   );
}
