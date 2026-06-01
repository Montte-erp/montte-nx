import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuLabel,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Input } from "@packages/ui/components/input";
import { NumberInput } from "@packages/ui/components/number-input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { cn } from "@packages/ui/lib/utils";
import type { Column } from "@tanstack/react-table";
import { Filter, X } from "lucide-react";
import { forwardRef, useId, type ComponentPropsWithoutRef } from "react";

function isString(value: unknown): value is string {
   return typeof value === "string";
}

function isRangeTuple(
   value: unknown,
): value is [number | undefined, number | undefined] {
   if (!Array.isArray(value) || value.length !== 2) return false;
   return value.every((item) => typeof item === "number" || item === undefined);
}

function hasFilterValue(value: unknown) {
   if (value == null) return false;
   if (typeof value === "string") return value.trim().length > 0;
   if (Array.isArray(value)) return value.some(hasFilterValue);
   return true;
}

function getLabel<TData>(column: Column<TData, unknown>) {
   return column.columnDef.meta?.label ?? column.id;
}

const FilterTrigger = forwardRef<
   HTMLButtonElement,
   ComponentPropsWithoutRef<"button"> & { active: boolean; label: string }
>(
   (
      {
         active,
         className,
         label,
         onClick,
         onPointerDown,
         type = "button",
         ...props
      },
      ref,
   ) => (
      <button
         ref={ref}
         type={type}
         aria-label={`Filtrar ${label}`}
         aria-pressed={active}
         className={cn(
            "relative inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active && "bg-accent text-foreground",
            className,
         )}
         onClick={(event) => {
            event.stopPropagation();
            onClick?.(event);
         }}
         onPointerDown={(event) => {
            event.stopPropagation();
            onPointerDown?.(event);
         }}
         {...props}
      >
         <Filter className="size-3.5" />
         {active ? (
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
         ) : null}
      </button>
   ),
);
FilterTrigger.displayName = "FilterTrigger";

interface DataTableColumnFilterProps<TData> {
   column: Column<TData, unknown>;
}

export function DataTableColumnFilter<TData>({
   column,
}: DataTableColumnFilterProps<TData>) {
   const variant = column.columnDef.meta?.filterVariant;
   if (!variant) return null;

   if (variant === "select") return <SelectFilterDropdown column={column} />;

   return <FilterPopover column={column} variant={variant} />;
}

function SelectFilterDropdown<TData>({
   column,
}: {
   column: Column<TData, unknown>;
}) {
   const value = column.getFilterValue();
   const selected = isString(value) ? value : undefined;
   const active = hasFilterValue(value);
   const label = getLabel(column);
   const editOptions = column.columnDef.meta?.editOptions ?? [];
   const facetOptions = Array.from(column.getFacetedUniqueValues().keys())
      .filter(
         (item): item is string => typeof item === "string" && item.length > 0,
      )
      .sort()
      .map((item) => ({ value: item, label: item }));
   const options = editOptions.length > 0 ? editOptions : facetOptions;

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <FilterTrigger active={active} label={label} />
         </DropdownMenuTrigger>
         <DropdownMenuContent
            align="start"
            className="z-[80] w-56"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
         >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
               Filtrar por {label}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
               onValueChange={(next) =>
                  column.setFilterValue(next === "__all" ? undefined : next)
               }
               value={selected ?? "__all"}
            >
               <DropdownMenuRadioItem value="__all">
                  Todos
               </DropdownMenuRadioItem>
               {options.map((option) => (
                  <DropdownMenuRadioItem
                     key={option.value}
                     value={option.value}
                  >
                     <span className="truncate">{option.label}</span>
                  </DropdownMenuRadioItem>
               ))}
            </DropdownMenuRadioGroup>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}

function FilterPopover<TData>({
   column,
   variant,
}: {
   column: Column<TData, unknown>;
   variant: "date" | "range" | "text";
}) {
   const value = column.getFilterValue();
   const active = hasFilterValue(value);
   const label = getLabel(column);

   return (
      <Popover>
         <PopoverTrigger asChild>
            <FilterTrigger active={active} label={label} />
         </PopoverTrigger>
         <PopoverContent
            align="start"
            className="z-[80] w-64 p-2"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
         >
            <div className="flex items-center justify-between gap-2 px-1 py-1">
               <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-muted-foreground">
                     Filtrar por {label}
                  </div>
               </div>
               {active ? (
                  <Button
                     className="h-6 px-2 text-xs"
                     onClick={() => column.setFilterValue(undefined)}
                     size="xs"
                     type="button"
                     variant="ghost"
                  >
                     <X className="size-3" />
                     Limpar
                  </Button>
               ) : null}
            </div>
            <div className="border-t pt-2">
               {variant === "text" && (
                  <TextFilter column={column} value={value} />
               )}
               {variant === "range" && (
                  <RangeFilter column={column} value={value} />
               )}
               {variant === "date" && (
                  <DateFilter column={column} value={value} />
               )}
            </div>
         </PopoverContent>
      </Popover>
   );
}

function TextFilter<TData>({
   column,
   value,
}: {
   column: Column<TData, unknown>;
   value: unknown;
}) {
   const inputId = useId();
   return (
      <div className="flex flex-col gap-2">
         <label
            className="px-1 text-xs text-muted-foreground"
            htmlFor={inputId}
         >
            Contém
         </label>
         <Input
            autoFocus
            className="h-8"
            id={inputId}
            onChange={(event) =>
               column.setFilterValue(event.target.value || undefined)
            }
            placeholder="Digite para filtrar..."
            value={isString(value) ? value : ""}
         />
      </div>
   );
}

function DateFilter<TData>({
   column,
   value,
}: {
   column: Column<TData, unknown>;
   value: unknown;
}) {
   const inputId = useId();
   return (
      <div className="flex flex-col gap-2">
         <label
            className="px-1 text-xs text-muted-foreground"
            htmlFor={inputId}
         >
            Data
         </label>
         <Input
            className="h-8"
            id={inputId}
            onChange={(event) =>
               column.setFilterValue(event.target.value || undefined)
            }
            type="date"
            value={isString(value) ? value : ""}
         />
      </div>
   );
}

function RangeFilter<TData>({
   column,
   value,
}: {
   column: Column<TData, unknown>;
   value: unknown;
}) {
   const minId = useId();
   const maxId = useId();
   const tuple = isRangeTuple(value) ? value : undefined;
   const min = tuple?.[0];
   const max = tuple?.[1];

   function update(nextMin: number | undefined, nextMax: number | undefined) {
      if (nextMin === undefined && nextMax === undefined) {
         column.setFilterValue(undefined);
         return;
      }
      column.setFilterValue([nextMin, nextMax]);
   }

   return (
      <div className="flex flex-col gap-2">
         <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
               <label
                  className="px-1 text-xs text-muted-foreground"
                  htmlFor={minId}
               >
                  Mínimo
               </label>
               <NumberInput
                  className="h-8"
                  id={minId}
                  min={0}
                  onChange={(value) => update(value, max)}
                  value={min ?? 0}
               />
            </div>
            <div className="flex flex-col gap-2">
               <label
                  className="px-1 text-xs text-muted-foreground"
                  htmlFor={maxId}
               >
                  Máximo
               </label>
               <NumberInput
                  className="h-8"
                  id={maxId}
                  min={0}
                  onChange={(value) => update(min, value)}
                  value={max ?? 0}
               />
            </div>
         </div>
         <Badge variant="secondary" className="w-fit text-xs">
            Use um ou dois limites.
         </Badge>
      </div>
   );
}
