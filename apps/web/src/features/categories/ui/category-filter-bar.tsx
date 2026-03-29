import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Switch } from "@packages/ui/components/switch";
import { Search, X } from "lucide-react";
import { useDebouncedValue } from "foxact/use-debounced-value";
import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";
import { useCallback, useEffect, useRef, useState } from "react";

export interface CategoryFilters {
   search: string;
   type: "income" | "expense" | undefined;
   includeArchived: boolean;
   page: number;
}

interface CategoryFilterBarProps {
   filters: CategoryFilters;
   onFiltersChange: (filters: CategoryFilters) => void;
}

export function CategoryFilterBar({
   filters,
   onFiltersChange,
}: CategoryFilterBarProps) {
   const [searchInput, setSearchInput] = useState(filters.search);
   const debouncedSearch = useDebouncedValue(searchInput, 350);

   const stableOnFiltersChange = useStableHandler(onFiltersChange);
   const filtersRef = useRef(filters);
   useEffect(() => {
      filtersRef.current = filters;
   });

   const isMounted = useRef(false);
   useEffect(() => {
      if (!isMounted.current) {
         isMounted.current = true;
         return;
      }
      stableOnFiltersChange({
         ...filtersRef.current,
         search: debouncedSearch,
         page: 1,
      });
   }, [debouncedSearch, stableOnFiltersChange]);

   const hasActiveFilters =
      filters.search || filters.type || filters.includeArchived;

   const handleClear = useCallback(() => {
      onFiltersChange({
         search: "",
         type: undefined,
         includeArchived: false,
         page: 1,
      });
   }, [onFiltersChange]);

   return (
      <div className="flex flex-col gap-4">
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
               className="pl-9"
               value={searchInput}
               onChange={(e) => setSearchInput(e.target.value)}
               placeholder="Buscar por nome ou palavra-chave..."
            />
         </div>
         <div className="flex flex-wrap items-center gap-4">
            <Select
               onValueChange={(v) =>
                  onFiltersChange({
                     ...filters,
                     type:
                        v === "all" ? undefined : (v as "income" | "expense"),
                     page: 1,
                  })
               }
               value={filters.type ?? "all"}
            >
               <SelectTrigger className="w-[160px]">
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
               </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
               <Switch
                  checked={filters.includeArchived}
                  id="show-archived"
                  onCheckedChange={(checked) =>
                     onFiltersChange({
                        ...filters,
                        includeArchived: checked,
                        page: 1,
                     })
                  }
               />
               <Label htmlFor="show-archived">Mostrar arquivadas</Label>
            </div>
            {hasActiveFilters && (
               <Button
                  className="gap-1"
                  onClick={handleClear}
                  size="sm"
                  variant="ghost"
               >
                  <X className="size-3.5" />
                  Limpar filtros
               </Button>
            )}
         </div>
      </div>
   );
}
