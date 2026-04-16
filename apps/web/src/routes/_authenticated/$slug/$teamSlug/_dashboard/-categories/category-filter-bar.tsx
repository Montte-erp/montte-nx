import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { useRouter } from "@tanstack/react-router";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import {
   Archive,
   LayoutList,
   Layers,
   Search,
   TrendingDown,
   TrendingUp,
   X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface CategoryFilterBarProps {
   search: string;
   type: "income" | "expense" | undefined;
   includeArchived: boolean;
   groupBy: boolean;
   onSearchChange: (value: string) => void;
   onTypeChange: (value: "income" | "expense" | undefined) => void;
   onIncludeArchivedChange: (checked: boolean) => void;
   onGroupByChange: (checked: boolean) => void;
   onClear: () => void;
}

export function CategoryFilterBar({
   search,
   type,
   includeArchived,
   groupBy,
   onSearchChange,
   onTypeChange,
   onIncludeArchivedChange,
   onGroupByChange,
   onClear,
}: CategoryFilterBarProps) {
   const router = useRouter();
   const [inputValue, setInputValue] = useState(search);

   const debouncedOnSearchChange = useDebouncedCallback(onSearchChange, {
      wait: 300,
   });

   useEffect(() => {
      if (search === "") setInputValue("");
   }, [search]);

   const hasActiveFilters =
      type !== undefined || includeArchived || search !== "";

   return (
      <div className="flex flex-col gap-2">
         <div className="flex items-center gap-2">
            <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
               <Input
                  className="pl-9"
                  onChange={(e) => {
                     setInputValue(e.target.value);
                     debouncedOnSearchChange(e.target.value);
                  }}
                  placeholder="Buscar por nome ou palavra-chave..."
                  value={inputValue}
               />
            </div>
            <ToggleGroup
               onValueChange={(v) => {
                  if (v === "income" || v === "expense") {
                     onTypeChange(v);
                  } else {
                     onTypeChange(undefined);
                  }
               }}
               type="single"
               value={type ?? "all"}
               variant="outline"
            >
               <ToggleGroupItem className="gap-2 px-4" value="all">
                  <Layers className="size-4" />
                  Todos
               </ToggleGroupItem>
               <ToggleGroupItem className="gap-2 px-4" value="income">
                  <TrendingUp className="size-4" />
                  Receitas
               </ToggleGroupItem>
               <ToggleGroupItem className="gap-2 px-4" value="expense">
                  <TrendingDown className="size-4" />
                  Despesas
               </ToggleGroupItem>
            </ToggleGroup>
         </div>

         <div className="flex items-center gap-2 flex-wrap">
            <button
               className={
                  includeArchived
                     ? "inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground transition-colors"
                     : "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
               }
               onClick={() => {
                  onIncludeArchivedChange(!includeArchived);
                  router.preloadRoute({
                     to: ".",
                     search: { includeArchived: !includeArchived },
                  });
               }}
               type="button"
            >
               <Archive className="size-3" />
               Arquivadas
            </button>

            <button
               className={
                  groupBy
                     ? "inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground transition-colors"
                     : "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
               }
               onClick={() => onGroupByChange(!groupBy)}
               type="button"
            >
               <LayoutList className="size-3" />
               Agrupar por tipo
            </button>

            {hasActiveFilters && (
               <Button
                  className="h-7 rounded-full gap-2 text-muted-foreground hover:text-foreground text-xs px-3"
                  onClick={onClear}
                  size="sm"
                  variant="ghost"
               >
                  <X className="size-3" />
                  Limpar filtros
               </Button>
            )}
         </div>
      </div>
   );
}
