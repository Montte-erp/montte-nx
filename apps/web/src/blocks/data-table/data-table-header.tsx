import {
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import {
   flexRender,
   type Column,
   type RowData,
   type Table,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Pin, PinOff } from "lucide-react";

declare module "@tanstack/react-table" {
   interface ColumnMeta<TData extends RowData, TValue> {
      resizable?: boolean;
      pinnable?: boolean;
      reorderable?: boolean;
      exportValue?: (row: TData, value: TValue) => string;
      exportIgnore?: boolean;
   }
}

function getPinStyles<TData>(column: Column<TData>): React.CSSProperties {
   const pin = column.getIsPinned();
   if (!pin) return {};
   const isLeft = pin === "left";
   const offset = isLeft ? column.getStart("left") : column.getAfter("right");
   return {
      position: "sticky",
      [isLeft ? "left" : "right"]: `${offset}px`,
      zIndex: 2,
      background: "var(--card)",
   };
}

interface DataTableHeaderProps<TData> {
   table: Table<TData>;
}

export function DataTableHeader<TData>({ table }: DataTableHeaderProps<TData>) {
   return (
      <TableHeader className="sticky top-0 z-10 bg-card">
         {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
               {group.headers.map((header) => {
                  const col = header.column;
                  const meta = col.columnDef.meta;
                  const canSort = col.getCanSort();
                  const sortDir = col.getIsSorted();
                  const align = meta?.align ?? "left";

                  return (
                     <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                           width: header.getSize(),
                           textAlign: align,
                           ...getPinStyles(col),
                        }}
                        className={cn(
                           "relative",
                           col.getIsPinned() &&
                              "shadow-[inset_-1px_0_0_var(--border)]",
                        )}
                     >
                        {header.isPlaceholder ? null : (
                           <div className="flex items-center gap-2">
                              <div
                                 className={cn(
                                    "flex-1 truncate",
                                    canSort && "cursor-pointer select-none",
                                 )}
                                 onClick={
                                    canSort
                                       ? col.getToggleSortingHandler()
                                       : undefined
                                 }
                              >
                                 {flexRender(
                                    col.columnDef.header,
                                    header.getContext(),
                                 )}
                              </div>
                              {canSort && (
                                 <span className="text-muted-foreground">
                                    {sortDir === "asc" ? (
                                       <ArrowUp className="size-3" />
                                    ) : sortDir === "desc" ? (
                                       <ArrowDown className="size-3" />
                                    ) : (
                                       <ArrowUpDown className="size-3 opacity-50" />
                                    )}
                                 </span>
                              )}
                              {meta?.pinnable && col.getCanPin() && (
                                 <Button
                                    className="size-5"
                                    onClick={() =>
                                       col.pin(
                                          col.getIsPinned() ? false : "left",
                                       )
                                    }
                                    size="icon"
                                    tooltip={
                                       col.getIsPinned()
                                          ? "Desafixar coluna"
                                          : "Fixar coluna"
                                    }
                                    type="button"
                                    variant="ghost"
                                 >
                                    {col.getIsPinned() ? (
                                       <PinOff className="size-3" />
                                    ) : (
                                       <Pin className="size-3" />
                                    )}
                                 </Button>
                              )}
                           </div>
                        )}
                        {meta?.resizable && col.getCanResize() && (
                           <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={cn(
                                 "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-transparent hover:bg-primary/50",
                                 col.getIsResizing() && "bg-primary",
                              )}
                           />
                        )}
                     </TableHead>
                  );
               })}
            </TableRow>
         ))}
      </TableHeader>
   );
}
