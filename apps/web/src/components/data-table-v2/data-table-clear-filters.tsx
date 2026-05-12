import { Button } from "@packages/ui/components/button";
import { FilterX } from "lucide-react";
import { useDataTableContext } from "./data-table-root";

interface DataTableClearFiltersProps {
   onClear?: () => void;
}

export function DataTableClearFilters({ onClear }: DataTableClearFiltersProps) {
   const { table } = useDataTableContext();
   const hasFilters = table.getState().columnFilters.length > 0;

   if (!hasFilters) return null;

   return (
      <Button
         onClick={() => {
            table.resetColumnFilters();
            onClear?.();
         }}
         size="sm"
         tooltip="Limpar todos os filtros"
         type="button"
         variant="ghost"
      >
         <FilterX />
         Limpar
      </Button>
   );
}
