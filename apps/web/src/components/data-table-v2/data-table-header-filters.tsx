import { TableHead, TableRow } from "@packages/ui/components/table";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { useDataTableContext } from "./data-table-root";

export function DataTableHeaderFilters() {
   const { table } = useDataTableContext();
   const groups = table.getHeaderGroups();
   const lastGroup = groups[groups.length - 1];
   if (!lastGroup) return null;

   const hasAny = lastGroup.headers.some(
      (h) => h.column.columnDef.meta?.filterVariant,
   );
   if (!hasAny) return null;

   return (
      <TableRow className="bg-muted/30">
         {lastGroup.headers.map((header) => {
            const col = header.column;
            const variant = col.columnDef.meta?.filterVariant;
            const value = col.getFilterValue();

            return (
               <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {variant === "text" && (
                     <Input
                        className="h-8"
                        onChange={(e) =>
                           col.setFilterValue(e.target.value || undefined)
                        }
                        placeholder="Filtrar..."
                        value={(value as string) ?? ""}
                     />
                  )}
                  {variant === "select" && (
                     <SelectFilterCell
                        column={col}
                        value={value as string | undefined}
                     />
                  )}
                  {variant === "range" && (
                     <RangeFilterCell
                        column={col}
                        value={value as [number?, number?] | undefined}
                     />
                  )}
                  {variant === "date" && (
                     <Input
                        className="h-8"
                        onChange={(e) =>
                           col.setFilterValue(e.target.value || undefined)
                        }
                        type="date"
                        value={(value as string) ?? ""}
                     />
                  )}
               </TableHead>
            );
         })}
      </TableRow>
   );
}

interface SelectFilterCellProps {
   // oxlint-ignore no-explicit-any
   column: any;
   value: string | undefined;
}

function SelectFilterCell({ column, value }: SelectFilterCellProps) {
   const facets = column.getFacetedUniqueValues() as Map<string, number>;
   const options = Array.from(facets.keys()).filter(Boolean).sort();

   return (
      <Select
         onValueChange={(v) =>
            column.setFilterValue(v === "__all" ? undefined : v)
         }
         value={value ?? "__all"}
      >
         <SelectTrigger className="h-8">
            <SelectValue placeholder="Todos" />
         </SelectTrigger>
         <SelectContent>
            <SelectItem value="__all">Todos</SelectItem>
            {options.map((opt) => (
               <SelectItem key={opt} value={opt}>
                  {opt}
               </SelectItem>
            ))}
         </SelectContent>
      </Select>
   );
}

interface RangeFilterCellProps {
   // oxlint-ignore no-explicit-any
   column: any;
   value: [number?, number?] | undefined;
}

function RangeFilterCell({ column, value }: RangeFilterCellProps) {
   const [min, max] = value ?? [undefined, undefined];
   return (
      <div className="flex gap-1">
         <Input
            className="h-8"
            onChange={(e) =>
               column.setFilterValue([
                  e.target.value ? Number(e.target.value) : undefined,
                  max,
               ])
            }
            placeholder="Min"
            type="number"
            value={min ?? ""}
         />
         <Input
            className="h-8"
            onChange={(e) =>
               column.setFilterValue([
                  min,
                  e.target.value ? Number(e.target.value) : undefined,
               ])
            }
            placeholder="Max"
            type="number"
            value={max ?? ""}
         />
      </div>
   );
}
