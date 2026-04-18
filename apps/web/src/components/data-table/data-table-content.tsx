import type { Row } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { cn } from "@packages/ui/lib/utils";
import { useMemo, useState } from "react";
import type React from "react";
import { useDataTable } from "./data-table-root";

function useGroupedRows<TData>(
   rows: Row<TData>[],
   groupBy?: (row: TData) => string,
) {
   return useMemo(() => {
      if (!groupBy) return null;
      const groups = new Map<string, Row<TData>[]>();
      for (const row of rows) {
         const key = groupBy(row.original);
         const existing = groups.get(key);
         if (existing) existing.push(row);
         else groups.set(key, [row]);
      }
      return groups;
   }, [rows, groupBy]);
}

function DataTableBodyRow<TData>({ row }: { row: Row<TData> }) {
   if (row.depth > 0) {
      return (
         <>
            {row.getVisibleCells().map((cell, i) => (
               <TableCell
                  className={cn(
                     cell.column.id === "__select"
                        ? "w-10 p-0"
                        : "truncate text-sm",
                     i === 1 && "pl-6",
                  )}
                  key={cell.id}
                  style={{ maxWidth: cell.column.columnDef.maxSize }}
               >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
               </TableCell>
            ))}
         </>
      );
   }

   return (
      <>
         {row.getVisibleCells().map((cell) => (
            <TableCell
               className={cn(
                  cell.column.id === "__select" ? "w-10 px-2" : "truncate",
                  cell.column.columnDef.meta?.align === "right" && "text-right",
                  cell.column.columnDef.meta?.align === "center" &&
                     "text-center",
               )}
               key={cell.id}
               style={{ maxWidth: cell.column.columnDef.maxSize }}
            >
               {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
         ))}
      </>
   );
}

function DataTableBodyRows<TData>({
   rows,
   groupedRows,
   renderGroupHeader,
   columnCount,
}: {
   rows: Row<TData>[];
   groupedRows: Map<string, Row<TData>[]> | null;
   renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
   columnCount: number;
}) {
   if (!rows.length) {
      return (
         <TableRow>
            <TableCell className="h-24 text-center" colSpan={columnCount}>
               Nenhum resultado encontrado.
            </TableCell>
         </TableRow>
      );
   }

   const renderRow = (row: Row<TData>) => (
      <TableRow
         className={cn("bg-card", row.getIsSelected() && "bg-muted/50")}
         data-state={row.getIsSelected() ? "selected" : undefined}
         key={row.id}
      >
         <DataTableBodyRow row={row} />
      </TableRow>
   );

   if (groupedRows && renderGroupHeader) {
      return Array.from(groupedRows.entries()).flatMap(([key, groupRows]) => [
         <TableRow className="hover:bg-transparent" key={`group-${key}`}>
            <TableCell
               className="bg-muted px-4 py-2 text-sm font-medium text-foreground"
               colSpan={columnCount}
            >
               {renderGroupHeader(key, groupRows)}
            </TableCell>
         </TableRow>,
         ...groupRows.map(renderRow),
      ]);
   }

   return rows.map(renderRow);
}

interface DataTableContentProps {
   maxHeight?: number;
}

export function DataTableContent<TData>({ maxHeight }: DataTableContentProps) {
   const { table, groupBy, renderGroupHeader, hasEmptyState } =
      useDataTable<TData>();
   const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

   const rows = table.getRowModel().rows;
   const groupedRows = useGroupedRows(rows, groupBy);
   const isVirtualized = maxHeight !== undefined && !groupBy;

   const virtualizer = useVirtualizer({
      count: rows.length,
      getScrollElement: () => scrollEl,
      estimateSize: () => 53,
      overscan: 5,
      enabled: isVirtualized,
   });

   if (table.getCoreRowModel().rows.length === 0 && hasEmptyState) return null;

   const columnCount = table.getVisibleLeafColumns().length;
   const virtualItems = isVirtualized ? virtualizer.getVirtualItems() : null;
   const totalSize = virtualizer.getTotalSize();
   const paddingTop =
      virtualItems && virtualItems.length > 0 ? virtualItems[0].start : 0;
   const paddingBottom =
      virtualItems && virtualItems.length > 0
         ? totalSize - virtualItems[virtualItems.length - 1].end
         : 0;

   return (
      <div
         className="rounded-md border overflow-hidden"
         ref={isVirtualized ? setScrollEl : undefined}
         style={isVirtualized ? { maxHeight, overflowY: "auto" } : undefined}
      >
         <Table className="border-separate border-spacing-0">
            <TableHeader>
               {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                     className="bg-muted/50 hover:bg-muted/50"
                     key={headerGroup.id}
                  >
                     {headerGroup.headers.map((header) => {
                        if (header.column.id === "__actions") {
                           return <TableHead className="w-0" key={header.id} />;
                        }
                        if (header.column.id === "__select") {
                           return (
                              <TableHead className="w-10 px-2" key={header.id}>
                                 {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                         header.column.columnDef.header,
                                         header.getContext(),
                                      )}
                              </TableHead>
                           );
                        }
                        return (
                           <TableHead
                              className={cn(
                                 "text-xs font-medium",
                                 header.column.columnDef.meta?.align ===
                                    "right" && "text-right",
                                 header.column.columnDef.meta?.align ===
                                    "center" && "text-center",
                              )}
                              colSpan={header.colSpan}
                              key={header.id}
                              aria-sort={
                                 header.column.getCanSort()
                                    ? header.column.getIsSorted() === "asc"
                                       ? "ascending"
                                       : header.column.getIsSorted() === "desc"
                                         ? "descending"
                                         : "none"
                                    : undefined
                              }
                           >
                              {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                 <Button
                                    className="h-8 gap-2 px-2 text-xs font-medium"
                                    onClick={header.column.getToggleSortingHandler()}
                                    variant="ghost"
                                 >
                                    {flexRender(
                                       header.column.columnDef.header,
                                       header.getContext(),
                                    )}
                                    {header.column.getIsSorted() === "asc" ? (
                                       <ArrowUp data-icon="inline-end" />
                                    ) : header.column.getIsSorted() ===
                                      "desc" ? (
                                       <ArrowDown data-icon="inline-end" />
                                    ) : (
                                       <ArrowUpDown
                                          className="opacity-50"
                                          data-icon="inline-end"
                                       />
                                    )}
                                 </Button>
                              ) : (
                                 <span className="px-2 text-xs font-medium">
                                    {flexRender(
                                       header.column.columnDef.header,
                                       header.getContext(),
                                    )}
                                 </span>
                              )}
                           </TableHead>
                        );
                     })}
                  </TableRow>
               ))}
            </TableHeader>
            <TableBody>
               {isVirtualized && virtualItems ? (
                  <>
                     {paddingTop > 0 && (
                        <TableRow>
                           <TableCell
                              colSpan={columnCount}
                              style={{ height: paddingTop, padding: 0 }}
                           />
                        </TableRow>
                     )}
                     <DataTableBodyRows
                        columnCount={columnCount}
                        groupedRows={null}
                        rows={virtualItems.map((v) => rows[v.index])}
                     />
                     {paddingBottom > 0 && (
                        <TableRow>
                           <TableCell
                              colSpan={columnCount}
                              style={{ height: paddingBottom, padding: 0 }}
                           />
                        </TableRow>
                     )}
                  </>
               ) : (
                  <DataTableBodyRows
                     columnCount={columnCount}
                     groupedRows={groupedRows}
                     renderGroupHeader={renderGroupHeader}
                     rows={rows}
                  />
               )}
            </TableBody>
         </Table>
      </div>
   );
}
