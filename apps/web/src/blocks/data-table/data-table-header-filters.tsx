import { TableHead, TableRow } from "@packages/ui/components/table";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import type { Column, Table } from "@tanstack/react-table";

function isString(v: unknown): v is string {
   return typeof v === "string";
}

function isRangeTuple(v: unknown): v is [number?, number?] {
   if (!Array.isArray(v) || v.length !== 2) return false;
   return v.every((x) => typeof x === "number" || x === undefined);
}

interface DataTableHeaderFiltersProps<TData> {
   table: Table<TData>;
}

export function DataTableHeaderFilters<TData>({
   table,
}: DataTableHeaderFiltersProps<TData>) {
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
            const raw = col.getFilterValue();

            return (
               <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {variant === "text" && (
                     <Input
                        className="h-8"
                        onChange={(e) =>
                           col.setFilterValue(e.target.value || undefined)
                        }
                        placeholder="Filtrar..."
                        value={isString(raw) ? raw : ""}
                     />
                  )}
                  {variant === "select" && (
                     <SelectFilterCell
                        column={col}
                        value={isString(raw) ? raw : undefined}
                     />
                  )}
                  {variant === "range" && (
                     <RangeFilterCell
                        column={col}
                        value={isRangeTuple(raw) ? raw : undefined}
                     />
                  )}
                  {variant === "date" && (
                     <Input
                        className="h-8"
                        onChange={(e) =>
                           col.setFilterValue(e.target.value || undefined)
                        }
                        type="date"
                        value={isString(raw) ? raw : ""}
                     />
                  )}
               </TableHead>
            );
         })}
      </TableRow>
   );
}

interface SelectFilterCellProps<TData> {
   column: Column<TData>;
   value: string | undefined;
}

function SelectFilterCell<TData>({
   column,
   value,
}: SelectFilterCellProps<TData>) {
   const facets = column.getFacetedUniqueValues();
   const options = Array.from(facets.keys())
      .filter((k): k is string => typeof k === "string" && k.length > 0)
      .sort();

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

interface RangeFilterCellProps<TData> {
   column: Column<TData>;
   value: [number?, number?] | undefined;
}

function RangeFilterCell<TData>({
   column,
   value,
}: RangeFilterCellProps<TData>) {
   const [min, max] = value ?? [undefined, undefined];
   return (
      <div className="flex gap-2">
         <Input
            className="h-8"
            onChange={(e) => {
               const n = Number(e.target.value);
               column.setFilterValue([
                  e.target.value === "" || !Number.isFinite(n) ? undefined : n,
                  max,
               ]);
            }}
            placeholder="Min"
            type="number"
            value={min ?? ""}
         />
         <Input
            className="h-8"
            onChange={(e) => {
               const n = Number(e.target.value);
               column.setFilterValue([
                  min,
                  e.target.value === "" || !Number.isFinite(n) ? undefined : n,
               ]);
            }}
            placeholder="Max"
            type="number"
            value={max ?? ""}
         />
      </div>
   );
}
