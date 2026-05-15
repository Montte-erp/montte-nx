import { TableBody, TableCell, TableRow } from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import {
   flexRender,
   type Column,
   type Row,
   type Table,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment } from "react";

function getPinStyles<TData>(column: Column<TData>): React.CSSProperties {
   const pin = column.getIsPinned();
   if (!pin) return {};
   const isLeft = pin === "left";
   const offset = isLeft ? column.getStart("left") : column.getAfter("right");
   return {
      position: "sticky",
      [isLeft ? "left" : "right"]: `${offset}px`,
      zIndex: 1,
      background: "var(--card)",
   };
}

interface DataTableBodyProps<TData> {
   table: Table<TData>;
   renderRow?: (props: { row: Row<TData> }) => React.ReactNode;
   renderExpandedRow?: (props: { row: Row<TData> }) => React.ReactNode;
   renderGroupLabel?: (props: { row: Row<TData> }) => React.ReactNode;
}

function defaultGroupLabel<TData>(row: Row<TData>): React.ReactNode {
   const groupingColumnId = row.groupingColumnId;
   const groupColumn = groupingColumnId
      ? row.getAllCells().find((c) => c.column.id === groupingColumnId)?.column
      : undefined;
   const formatter = groupColumn?.columnDef.meta?.formatGroupLabel;
   const value = row.groupingValue;
   const label = formatter
      ? formatter(value)
      : value === null || value === undefined || value === ""
        ? "—"
        : String(value);
   const columnLabel = groupColumn?.columnDef.meta?.label;
   const count = row.subRows.length;
   return (
      <div className="flex items-center gap-2">
         {columnLabel ? (
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
               {columnLabel}
            </span>
         ) : null}
         <span className="font-medium">{label}</span>
         <span className="text-muted-foreground text-xs">
            {count} {count === 1 ? "item" : "itens"}
         </span>
      </div>
   );
}

export function DataTableBody<TData>({
   table,
   renderRow,
   renderExpandedRow,
   renderGroupLabel,
}: DataTableBodyProps<TData>) {
   const rows = table.getRowModel().rows;
   const colSpan = table.getVisibleLeafColumns().length;

   return (
      <TableBody>
         {rows.map((row) => {
            if (row.getIsGrouped()) {
               return (
                  <TableRow key={row.id} className="bg-muted/40">
                     <TableCell className="py-2" colSpan={colSpan}>
                        <div className="flex items-center gap-2">
                           <Button
                              aria-label={
                                 row.getIsExpanded()
                                    ? "Recolher grupo"
                                    : "Expandir grupo"
                              }
                              onClick={row.getToggleExpandedHandler()}
                              size="icon-sm"
                              variant="ghost"
                           >
                              {row.getIsExpanded() ? (
                                 <ChevronDown />
                              ) : (
                                 <ChevronRight />
                              )}
                           </Button>
                           {renderGroupLabel
                              ? renderGroupLabel({ row })
                              : defaultGroupLabel(row)}
                        </div>
                     </TableCell>
                  </TableRow>
               );
            }

            const expanded = row.getIsExpanded();
            const body = renderRow ? (
               renderRow({ row })
            ) : (
               <TableRow
                  data-selected={row.getIsSelected()}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  key={row.id}
               >
                  {row.getVisibleCells().map((cell) => {
                     const col = cell.column;
                     const align = col.columnDef.meta?.align ?? "left";
                     return (
                        <TableCell
                           key={cell.id}
                           style={{
                              width: cell.column.getSize(),
                              textAlign: align,
                              ...getPinStyles(col),
                           }}
                           className={cn(
                              col.getIsPinned() &&
                                 "shadow-[inset_-1px_0_0_var(--border)]",
                           )}
                        >
                           {flexRender(col.columnDef.cell, cell.getContext())}
                        </TableCell>
                     );
                  })}
               </TableRow>
            );

            return (
               <Fragment key={row.id}>
                  {body}
                  {expanded && renderExpandedRow && (
                     <TableRow data-expanded>
                        <TableCell
                           className="bg-muted/20"
                           colSpan={row.getVisibleCells().length}
                        >
                           {renderExpandedRow({ row })}
                        </TableCell>
                     </TableRow>
                  )}
               </Fragment>
            );
         })}
      </TableBody>
   );
}
