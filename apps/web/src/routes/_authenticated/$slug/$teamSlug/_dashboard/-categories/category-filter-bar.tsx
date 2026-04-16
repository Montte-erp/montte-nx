import { Input } from "@packages/ui/components/input";
import { Toggle } from "@packages/ui/components/toggle";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useRouter } from "@tanstack/react-router";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import {
   Archive,
   Layers,
   LayoutList,
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
      <div className="flex flex-col gap-4">
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
            <Tooltip>
               <TooltipTrigger asChild>
                  <Toggle
                     aria-label="Mostrar arquivadas"
                     onPressedChange={(pressed) => {
                        onIncludeArchivedChange(pressed);
                        router.preloadRoute({
                           to: ".",
                           search: { includeArchived: pressed },
                        });
                     }}
                     pressed={includeArchived}
                     variant="outline"
                  >
                     <Archive className="size-4" />
                     Arquivadas
                  </Toggle>
               </TooltipTrigger>
               <TooltipContent>
                  Exibir categorias arquivadas na lista
               </TooltipContent>
            </Tooltip>

            <Tooltip>
               <TooltipTrigger asChild>
                  <Toggle
                     aria-label="Agrupar por tipo"
                     onPressedChange={onGroupByChange}
                     pressed={groupBy}
                     variant="outline"
                  >
                     <LayoutList className="size-4" />
                     Agrupar por tipo
                  </Toggle>
               </TooltipTrigger>
               <TooltipContent>
                  Separar categorias em grupos de Receita e Despesa
               </TooltipContent>
            </Tooltip>

            {hasActiveFilters && (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <button
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={onClear}
                        type="button"
                     >
                        <X className="size-3" />
                        Limpar filtros
                     </button>
                  </TooltipTrigger>
                  <TooltipContent>
                     Remover todos os filtros ativos
                  </TooltipContent>
               </Tooltip>
            )}
         </div>
      </div>
   );
}
