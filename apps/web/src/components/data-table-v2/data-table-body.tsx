import { TableBody, TableCell, TableRow } from "@packages/ui/components/table";
import { cn } from "@packages/ui/lib/utils";
import { flexRender, type Column, type Row } from "@tanstack/react-table";
import { Fragment } from "react";
import { useDataTableContext } from "./data-table-root";

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
   renderRow?: (props: { row: Row<TData> }) => React.ReactNode;
   renderExpandedRow?: (props: { row: Row<TData> }) => React.ReactNode;
}

export function DataTableBody<TData>({
   renderRow,
   renderExpandedRow,
}: DataTableBodyProps<TData>) {
   const { table } = useDataTableContext<TData>();
   const rows = table.getRowModel().rows;

   return (
      <TableBody>
         {rows.map((row) => {
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
