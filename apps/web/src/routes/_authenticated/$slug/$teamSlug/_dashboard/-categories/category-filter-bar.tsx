import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Separator } from "@packages/ui/components/separator";
import { Switch } from "@packages/ui/components/switch";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { useRouter } from "@tanstack/react-router";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { LayoutList, Search, X } from "lucide-react";
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
         <div className="relative">
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

         <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
               onValueChange={(v) => {
                  if (v === "income" || v === "expense") {
                     onTypeChange(v);
                  } else {
                     onTypeChange(undefined);
                  }
               }}
               size="sm"
               type="single"
               value={type ?? "all"}
               variant="outline"
            >
               <ToggleGroupItem value="all">Todos</ToggleGroupItem>
               <ToggleGroupItem value="income">Receitas</ToggleGroupItem>
               <ToggleGroupItem value="expense">Despesas</ToggleGroupItem>
            </ToggleGroup>

            <Separator orientation="vertical" className="h-5" />

            <div className="flex items-center gap-2">
               <Switch
                  checked={includeArchived}
                  id="show-archived"
                  onCheckedChange={onIncludeArchivedChange}
                  onMouseEnter={() =>
                     router.preloadRoute({
                        to: ".",
                        search: { includeArchived: !includeArchived },
                     })
                  }
               />
               <Label
                  className="cursor-pointer text-sm"
                  htmlFor="show-archived"
               >
                  Mostrar arquivadas
               </Label>
            </div>

            <Separator orientation="vertical" className="h-5" />

            <div className="flex items-center gap-2">
               <Switch
                  checked={groupBy}
                  id="group-by-type"
                  onCheckedChange={onGroupByChange}
               />
               <Label
                  className="cursor-pointer text-sm flex items-center gap-2"
                  htmlFor="group-by-type"
               >
                  <LayoutList className="size-3.5 text-muted-foreground" />
                  Agrupar por tipo
               </Label>
            </div>

            {hasActiveFilters && (
               <>
                  <Separator orientation="vertical" className="h-5" />
                  <Button
                     className="h-8 gap-2 text-muted-foreground hover:text-foreground"
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
      </div>
   );
}
