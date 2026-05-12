import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

function isRangeObject(v: unknown): v is { from?: unknown; to?: unknown } {
   return typeof v === "object" && v !== null && ("from" in v || "to" in v);
}

function formatValue(value: unknown): string {
   if (value == null) return "";
   if (Array.isArray(value)) return value.map(formatValue).join(", ");
   if (isRangeObject(value)) {
      return `${formatValue(value.from)} – ${formatValue(value.to)}`;
   }
   if (typeof value === "object") return JSON.stringify(value);
   return String(value);
}

interface DataTableFilterChipsProps<TData> {
   table: Table<TData>;
}

export function DataTableFilterChips<TData>({
   table,
}: DataTableFilterChipsProps<TData>) {
   const filters = table.getState().columnFilters;

   if (filters.length === 0) return null;

   return (
      <div className="flex flex-wrap items-center gap-2">
         {filters.map((f) => {
            const col = table.getColumn(f.id);
            const label = col?.columnDef.meta?.label ?? f.id;
            return (
               <Badge key={f.id} variant="secondary" className="gap-1 pr-1">
                  <span className="text-xs">
                     {label}: {formatValue(f.value)}
                  </span>
                  <Button
                     className="size-4 p-0"
                     onClick={() => col?.setFilterValue(undefined)}
                     size="icon"
                     type="button"
                     variant="ghost"
                  >
                     <X className="size-3" />
                     <span className="sr-only">Remover filtro {label}</span>
                  </Button>
               </Badge>
            );
         })}
      </div>
   );
}
