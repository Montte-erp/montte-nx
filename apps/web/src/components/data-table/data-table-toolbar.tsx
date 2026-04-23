import { useAsyncDebouncedCallback } from "@tanstack/react-pacer";
import { useForm, useStore } from "@tanstack/react-form";
import type { AnyFormApi } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { FilterX, ListFilter, Plus, Search, X } from "lucide-react";
import { createContextState } from "foxact/context-state";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useSingleton } from "foxact/use-singleton";
import { useCallback, useMemo } from "react";
import type React from "react";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupButton,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Switch } from "@packages/ui/components/switch";
import { cn } from "@packages/ui/lib/utils";
import { useDataTable, useDataTableStore } from "./data-table-root";
import { DataTableExportButton } from "./data-table-export";

export type ToolbarValues = {
   search: string;
   filters: Record<string, unknown>;
};

function DataTableFilterDropdown() {
   const externalFilters = useDataTableStore((s) => s.externalFilters);

   const allFilters = Object.values(externalFilters);
   if (allFilters.length === 0) return null;

   const activeCount = allFilters.filter((f) => f.active).length;

   const groups = allFilters.reduce<Record<string, typeof allFilters>>(
      (acc, f) => {
         if (!acc[f.group]) acc[f.group] = [];
         acc[f.group].push(f);
         return acc;
      },
      {},
   );

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button
               className={cn(
                  "relative shrink-0",
                  activeCount > 0 &&
                     "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary",
               )}
               size="icon-sm"
               tooltip="Filtros"
               variant="outline"
            >
               <ListFilter />
               {activeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                     {activeCount}
                  </span>
               )}
               <span className="sr-only">Filtros</span>
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end" className="w-64">
            {Object.entries(groups).map(([groupLabel, filters], gi) => (
               <DropdownMenuGroup key={groupLabel}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
                  {filters.map((filter) => (
                     <DropdownMenuItem
                        className="cursor-pointer justify-between gap-4 py-2.5"
                        key={filter.id}
                        onSelect={(e) => {
                           e.preventDefault();
                           filter.onToggle(!filter.active);
                        }}
                     >
                        <span className="flex items-center gap-2 text-sm">
                           {filter.renderIcon && (
                              <span className="text-muted-foreground shrink-0">
                                 {filter.renderIcon()}
                              </span>
                           )}
                           {filter.label}
                        </span>
                        <Switch
                           checked={filter.active}
                           className="pointer-events-none shrink-0"
                        />
                     </DropdownMenuItem>
                  ))}
               </DropdownMenuGroup>
            ))}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}

type DataTableToolbarContextValue = {
   form: AnyFormApi;
   onSearch?: (value: string) => Promise<void> | void;
};

const [DataTableToolbarCtxProvider, useToolbarCtxValue, useSetToolbarCtx] =
   createContextState<DataTableToolbarContextValue>();

export function useDataTableToolbar() {
   return useToolbarCtxValue();
}

function DataTableToolbarContextSync({
   value,
}: {
   value: DataTableToolbarContextValue;
}) {
   const setCtx = useSetToolbarCtx();
   useIsomorphicLayoutEffect(() => {
      setCtx(value);
   }, [setCtx, value]);
   return null;
}

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
   hideExport?: boolean;
}

export function DataTableToolbar({
   searchPlaceholder = "Buscar...",
   searchDefaultValue = "",
   onSearch,
   className,
   children,
   hideExport = false,
}: DataTableToolbarProps) {
   const { table, columnFilters } = useDataTable();
   const externalFilters = useDataTableStore((s) => s.externalFilters);

   const defaultFilters = useSingleton(() =>
      Object.fromEntries(columnFilters.map((f) => [f.id, f.value])),
   ).current;

   const form = useForm({
      defaultValues: { search: searchDefaultValue, filters: defaultFilters },
   });

   const inputValue = useStore(form.store, (s) => s.values.search);

   const activeColumnFilters = columnFilters.filter(
      ({ value }) => value != null && value !== "",
   );

   const activeExternalCount = Object.values(externalFilters).filter(
      (f) => f.active,
   ).length;

   const hasAnyFilter =
      activeColumnFilters.length > 0 ||
      inputValue !== "" ||
      activeExternalCount > 0;

   const debouncedSearch = useAsyncDebouncedCallback(
      async (value: string) => {
         await onSearch?.(value);
      },
      { wait: 350 },
   );

   const removeFilter = useCallback(
      (columnId: string) => {
         const current = form.getFieldValue("filters");
         form.setFieldValue("filters", { ...current, [columnId]: undefined });
         table.getColumn(columnId)?.setFilterValue(undefined);
      },
      [form, table],
   );

   const clearSearch = useCallback(async () => {
      form.setFieldValue("search", "");
      await onSearch?.("");
   }, [form, onSearch]);

   const clearAll = useCallback(async () => {
      form.setFieldValue("search", "");
      form.setFieldValue("filters", {});
      table.resetColumnFilters();
      await onSearch?.("");
      for (const filter of Object.values(externalFilters)) {
         if (filter.active) filter.onToggle(false);
      }
   }, [form, onSearch, table, externalFilters]);

   const ctx = useMemo<DataTableToolbarContextValue>(
      () => ({ form, onSearch }),
      [form, onSearch],
   );

   return (
      <DataTableToolbarCtxProvider initialState={ctx}>
         <DataTableToolbarContextSync value={ctx} />
         <div className={cn("flex items-center gap-2", className)}>
            <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
               {onSearch && (
                  <form.Field
                     name="search"
                     children={(field) => (
                        <InputGroup className="flex-1 min-w-0 max-w-sm">
                           <InputGroupAddon>
                              <Search
                                 className="text-muted-foreground"
                                 aria-hidden="true"
                              />
                           </InputGroupAddon>
                           <InputGroupInput
                              aria-label={searchPlaceholder}
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
                                    <span className="sr-only">
                                       Limpar busca
                                    </span>
                                 </InputGroupButton>
                              </InputGroupAddon>
                           )}
                        </InputGroup>
                     )}
                  />
               )}

               <DataTableFilterDropdown />

               {activeColumnFilters.map(({ id, value }) => {
                  const label =
                     table.getColumn(id)?.columnDef.meta?.label ?? id;
                  return (
                     <Badge
                        key={id}
                        variant="secondary"
                        className="shrink-0 gap-1.5 pr-1 font-normal"
                     >
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="font-medium text-foreground">
                           {filterValueLabel(value)}
                        </span>
                        <Button
                           size="icon"
                           variant="ghost"
                           className="size-4 text-muted-foreground/50 hover:text-foreground hover:bg-accent"
                           onClick={() => removeFilter(id)}
                        >
                           <X />
                           <span className="sr-only">
                              Remover filtro {label}
                           </span>
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

            <div className="flex shrink-0 items-center gap-2">
               {!hideExport && <DataTableExportButton />}
               {children}
            </div>
         </div>
      </DataTableToolbarCtxProvider>
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
