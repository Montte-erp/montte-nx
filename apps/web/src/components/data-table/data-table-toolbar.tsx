"use client";

import { useDebouncedCallback } from "@tanstack/react-pacer";
import { Link } from "@tanstack/react-router";
import { FilterX, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type React from "react";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupButton,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import { cn } from "@packages/ui/lib/utils";
import { useDataTable } from "./data-table-root";

function filterValueLabel(value: unknown): string {
   if (Array.isArray(value)) return value.join(", ");
   if (value === null || value === undefined) return "";
   return String(value);
}

interface DataTableToolbarProps {
   searchColumnId?: string;
   searchPlaceholder?: string;
   className?: string;
   children?: React.ReactNode;
}

export function DataTableToolbar({
   searchColumnId,
   searchPlaceholder = "Buscar...",
   className,
   children,
}: DataTableToolbarProps) {
   const { table, columnFilters } = useDataTable();

   const currentSearchValue = searchColumnId
      ? String(columnFilters.find((f) => f.id === searchColumnId)?.value ?? "")
      : "";

   const [inputValue, setInputValue] = useState(currentSearchValue);

   useEffect(() => {
      setInputValue(currentSearchValue);
   }, [currentSearchValue]);

   const applySearch = useDebouncedCallback(
      (value: string) => {
         if (!searchColumnId) return;
         table.getColumn(searchColumnId)?.setFilterValue(value || undefined);
      },
      { wait: 350 },
   );

   const activeFilters = columnFilters.filter((f) => {
      if (f.id === searchColumnId) return false;
      return f.value !== undefined && f.value !== null && f.value !== "";
   });

   const hasAnyFilter =
      columnFilters.length > 0 &&
      columnFilters.some((f) => {
         if (f.id === searchColumnId) return inputValue !== "";
         return f.value !== undefined && f.value !== null && f.value !== "";
      });

   function removeFilter(columnId: string) {
      table.getColumn(columnId)?.setFilterValue(undefined);
      if (columnId === searchColumnId) setInputValue("");
   }

   function clearSearch() {
      setInputValue("");
      if (searchColumnId)
         table.getColumn(searchColumnId)?.setFilterValue(undefined);
   }

   function clearAll() {
      table.resetColumnFilters();
      setInputValue("");
   }

   return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
         {searchColumnId && (
            <InputGroup className="w-[220px]">
               <InputGroupAddon>
                  <Search className="text-muted-foreground" />
               </InputGroupAddon>
               <InputGroupInput
                  placeholder={searchPlaceholder}
                  value={inputValue}
                  onChange={(e) => {
                     setInputValue(e.target.value);
                     applySearch(e.target.value);
                  }}
               />
               {inputValue && (
                  <InputGroupAddon align="inline-end">
                     <InputGroupButton onClick={clearSearch}>
                        <X />
                        <span className="sr-only">Limpar busca</span>
                     </InputGroupButton>
                  </InputGroupAddon>
               )}
            </InputGroup>
         )}

         {activeFilters.map((filter) => {
            const label =
               table.getColumn(filter.id)?.columnDef.meta?.label ?? filter.id;
            const valueLabel = filterValueLabel(filter.value);
            return (
               <Badge
                  key={filter.id}
                  variant="secondary"
                  className="gap-1.5 pr-1 font-normal"
               >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-medium text-foreground">
                     {valueLabel}
                  </span>
                  <Button
                     size="icon"
                     variant="ghost"
                     className="size-4 text-muted-foreground/50 hover:text-foreground hover:bg-accent"
                     onClick={() => removeFilter(filter.id)}
                  >
                     <X />
                     <span className="sr-only">Remover filtro {label}</span>
                  </Button>
               </Badge>
            );
         })}

         {hasAnyFilter && (
            <Button
               variant="ghost"
               size="sm"
               className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
               onClick={clearAll}
            >
               <FilterX data-icon="inline-start" />
               Limpar todos
            </Button>
         )}

         {children && (
            <div className="ml-auto flex items-center gap-2">{children}</div>
         )}
      </div>
   );
}

interface DataTableNewActionProps {
   label?: string;
   onClick?: () => void;
   href?: string;
}

export function DataTableNewAction({
   label = "Novo",
   onClick,
   href,
}: DataTableNewActionProps) {
   if (href) {
      return (
         <Button asChild size="sm">
            <Link to={href as never}>
               <Plus data-icon="inline-start" />
               {label}
            </Link>
         </Button>
      );
   }
   return (
      <Button size="sm" onClick={onClick}>
         <Plus data-icon="inline-start" />
         {label}
      </Button>
   );
}
