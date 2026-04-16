import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Separator } from "@packages/ui/components/separator";
import { Archive, Pencil, Plus, Trash2 } from "lucide-react";
import type { CategoryRow } from "./categories-columns";

interface CategoriesCardViewProps {
   categories: CategoryRow[];
   onEdit: (category: CategoryRow) => void;
   onDelete: (category: CategoryRow) => void;
   onArchive: (category: CategoryRow) => void;
   onAddSubcategory: (category: CategoryRow) => void;
}

export function CategoriesCardView({
   categories,
   onEdit,
   onDelete,
   onArchive,
   onAddSubcategory,
}: CategoriesCardViewProps) {
   return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         {categories.map((cat) => (
            <div
               className="flex flex-col rounded-lg border bg-card"
               key={cat.id}
            >
               <div className="flex items-center gap-4 p-4">
                  {cat.color && (
                     <div
                        className="size-10 rounded-lg shrink-0"
                        style={{ backgroundColor: cat.color }}
                     />
                  )}
                  <div className="flex flex-col gap-2 min-w-0 flex-1">
                     <span className="font-medium truncate">{cat.name}</span>
                     {cat.type && (
                        <Badge
                           className={
                              cat.type === "income"
                                 ? "border-green-600 text-green-600 dark:border-green-500 dark:text-green-500 w-fit"
                                 : "w-fit"
                           }
                           variant={
                              cat.type === "income" ? "outline" : "destructive"
                           }
                        >
                           {cat.type === "income" ? "Receita" : "Despesa"}
                        </Badge>
                     )}
                  </div>
               </div>

               {cat.subcategories && cat.subcategories.length > 0 && (
                  <>
                     <Separator />
                     <div className="px-4 py-3 flex flex-col gap-1.5 bg-muted/20">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                           Subcategorias
                        </p>
                        <div className="flex flex-col gap-1">
                           {cat.subcategories.map((sub) => (
                              <div
                                 key={sub.id}
                                 className="flex items-center gap-2 pl-3 border-l-2 border-muted-foreground/20"
                              >
                                 <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                                 <span className="text-sm text-muted-foreground truncate">
                                    {sub.name}
                                 </span>
                              </div>
                           ))}
                        </div>
                     </div>
                  </>
               )}

               {!cat.isDefault && (
                  <>
                     <Separator />
                     <div className="flex items-center gap-2 px-4 py-2">
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
                     </div>
                  </>
               )}
            </div>
         ))}
      </div>
   );
}
