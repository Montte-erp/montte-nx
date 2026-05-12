import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { X } from "lucide-react";
import { useDataTableContext } from "./data-table-root";

function formatValue(value: unknown): string {
   if (value == null) return "";
   if (Array.isArray(value)) return value.map(formatValue).join(", ");
   if (typeof value === "object") {
      const v = value as { from?: unknown; to?: unknown };
      if ("from" in v || "to" in v) {
         return `${formatValue(v.from)} – ${formatValue(v.to)}`;
      }
      return JSON.stringify(value);
   }
   return String(value);
}

export function DataTableFilterChips() {
   const { table } = useDataTableContext();
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
