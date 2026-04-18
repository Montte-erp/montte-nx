"use client";

import { useAsyncDebouncedCallback } from "@tanstack/react-pacer";
import { Link } from "@tanstack/react-router";
import { FilterX, Plus, Search, X } from "lucide-react";
import { useForm } from "@tanstack/react-form";
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
   searchPlaceholder?: string;
   searchDefaultValue?: string;
   onSearch?: (value: string) => Promise<void> | void;
   className?: string;
   children?: React.ReactNode;
}

export function DataTableToolbar({
   searchPlaceholder = "Buscar...",
   searchDefaultValue = "",
   onSearch,
   className,
   children,
}: DataTableToolbarProps) {
   const { table, columnFilters } = useDataTable();

   const form = useForm({
      defaultValues: { search: searchDefaultValue },
   });

   const debouncedSearch = useAsyncDebouncedCallback(
      async (value: string) => {
         await onSearch?.(value);
      },
      { wait: 350 },
   );

   const activeFilters = columnFilters.filter(
      (f) => f.value !== undefined && f.value !== null && f.value !== "",
   );

   const inputValue = form.getFieldValue("search");
   const hasAnyFilter = activeFilters.length > 0 || inputValue !== "";

   function removeFilter(columnId: string) {
      table.getColumn(columnId)?.setFilterValue(undefined);
   }

   async function clearSearch() {
      form.setFieldValue("search", "");
      await onSearch?.("");
   }

   async function clearAll() {
      table.resetColumnFilters();
      if (inputValue !== "") {
         form.setFieldValue("search", "");
         await onSearch?.("");
      }
   }

   return (
      <div className={cn("flex items-center gap-2", className)}>
         <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
            {onSearch && (
               <form.Field name="search">
                  {(field) => (
                     <InputGroup className="flex-1 min-w-0 max-w-sm">
                        <InputGroupAddon>
                           <Search className="text-muted-foreground" />
                        </InputGroupAddon>
                        <InputGroupInput
                           placeholder={searchPlaceholder}
                           value={field.state.value}
                           onChange={(e) => {
                              field.handleChange(e.target.value);
                              debouncedSearch(e.target.value);
                           }}
                        />
                        {field.state.value && (
                           <InputGroupAddon align="inline-end">
                              <InputGroupButton onClick={clearSearch}>
                                 <X />
                                 <span className="sr-only">Limpar busca</span>
                              </InputGroupButton>
                           </InputGroupAddon>
                        )}
                     </InputGroup>
                  )}
               </form.Field>
            )}

            {activeFilters.map((filter) => {
               const label =
                  table.getColumn(filter.id)?.columnDef.meta?.label ??
                  filter.id;
               const valueLabel = filterValueLabel(filter.value);
               return (
                  <Badge
                     key={filter.id}
                     variant="secondary"
                     className="shrink-0 gap-1.5 pr-1 font-normal"
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
                  className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={clearAll}
               >
                  <FilterX data-icon="inline-start" />
                  Limpar todos
               </Button>
            )}
         </div>
         {children && (
            <div className="flex shrink-0 items-center gap-2">{children}</div>
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
