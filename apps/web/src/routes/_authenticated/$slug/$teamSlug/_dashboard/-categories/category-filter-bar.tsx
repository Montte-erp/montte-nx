import { Button } from "@packages/ui/components/button";
import { Label } from "@packages/ui/components/label";
import { Switch } from "@packages/ui/components/switch";
import { cn } from "@packages/ui/lib/utils";
import { Link, useRouter } from "@tanstack/react-router";
import { LayoutList, X } from "lucide-react";

interface CategoryFilterBarProps {
   type: "income" | "expense" | undefined;
   includeArchived: boolean;
   groupBy: boolean;
   onIncludeArchivedChange: (checked: boolean) => void;
   onGroupByChange: (checked: boolean) => void;
   onClear: () => void;
}

const TYPE_OPTIONS: { label: string; value: "income" | "expense" | undefined }[] = [
   { label: "Todos", value: undefined },
   { label: "Receitas", value: "income" },
   { label: "Despesas", value: "expense" },
];

export function CategoryFilterBar({
   type,
   includeArchived,
   groupBy,
   onIncludeArchivedChange,
   onGroupByChange,
   onClear,
}: CategoryFilterBarProps) {
   const router = useRouter();
   const hasActiveFilters = type !== undefined || includeArchived;

   return (
      <div className="flex flex-wrap items-center gap-2">
         <div className="flex items-center rounded-md border bg-background p-0.5 gap-0.5">
            {TYPE_OPTIONS.map((opt) => (
               <Link
                  className={cn(
                     "px-3 py-1.5 text-sm rounded-sm font-medium transition-colors",
                     type === opt.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  key={opt.label}
                  preload="intent"
                  search={(prev) => ({ ...prev, type: opt.value })}
               >
                  {opt.label}
               </Link>
            ))}
         </div>

         <div className="h-5 w-px bg-border" />

         <div className="flex items-center gap-2">
            <Switch
               checked={includeArchived}
               id="show-archived"
               onCheckedChange={onIncludeArchivedChange}
               onMouseEnter={() =>
                  router.preloadRoute({
                     to: ".",
                     search: (prev) => ({ ...prev, includeArchived: !includeArchived }),
                  })
               }
            />
            <Label className="cursor-pointer text-sm" htmlFor="show-archived">
               Mostrar arquivadas
            </Label>
         </div>

         <div className="h-5 w-px bg-border" />

         <div className="flex items-center gap-2">
            <Switch
               checked={groupBy}
               id="group-by-type"
               onCheckedChange={onGroupByChange}
            />
            <Label className="cursor-pointer text-sm flex items-center gap-1.5" htmlFor="group-by-type">
               <LayoutList className="size-3.5 text-muted-foreground" />
               Agrupar por tipo
            </Label>
         </div>

         {hasActiveFilters && (
            <>
               <div className="h-5 w-px bg-border" />
               <Button
                  className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={onClear}
                  size="sm"
                  variant="ghost"
               >
                  <X className="size-3.5" />
                  Limpar filtros
               </Button>
            </>
         )}
      </div>
   );
}
