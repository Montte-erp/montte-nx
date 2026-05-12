import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Columns3 } from "lucide-react";
import { useDataTableContext } from "./data-table-root";

export function DataTableColumnVisibility() {
   const { table } = useDataTableContext();
   const cols = table
      .getAllLeafColumns()
      .filter(
         (c) => c.getCanHide() && c.id !== "__select" && c.id !== "__actions",
      );

   if (cols.length === 0) return null;

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button
               size="icon-sm"
               tooltip="Colunas"
               type="button"
               variant="outline"
            >
               <Columns3 />
               <span className="sr-only">Colunas</span>
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {cols.map((col) => {
               const label = col.columnDef.meta?.label ?? col.id;
               return (
                  <DropdownMenuItem
                     key={col.id}
                     onSelect={(e) => {
                        e.preventDefault();
                        col.toggleVisibility(!col.getIsVisible());
                     }}
                  >
                     <Checkbox checked={col.getIsVisible()} />
                     <span className="ml-2 text-sm">{label}</span>
                  </DropdownMenuItem>
               );
            })}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
