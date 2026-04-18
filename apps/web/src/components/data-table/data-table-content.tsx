import type { Row } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
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
import { useDataTableContext, useDataTableStore } from "./data-table-root";

function DataTableBodyRow<TData>({ row }: { row: Row<TData> }) {
   if (row.depth > 0) {
      return (
         <>
            {row.getVisibleCells().map((cell, i) => (
               <TableCell
                  className={cn(
                     cell.column.id === "__select"
                        ? "w-[40px] p-0"
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
                  cell.column.id === "__select" ? "w-[40px] px-2" : "truncate",
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
   groupBy,
   renderGroupHeader,
   columnCount,
}: {
   rows: Row<TData>[];
   groupBy?: (row: TData) => string;
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

   if (groupBy && renderGroupHeader) {
      const groups = new Map<string, Row<TData>[]>();
      for (const row of rows) {
         const key = groupBy(row.original);
         const existing = groups.get(key);
         if (existing) existing.push(row);
         else groups.set(key, [row]);
      }
      return Array.from(groups.entries()).flatMap(([key, groupRows]) => [
         <TableRow className="hover:bg-transparent" key={`group-${key}`}>
            <TableCell
               className="py-2 px-4 bg-muted text-sm font-medium text-foreground"
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

export function DataTableContent<TData>() {
   const { table, groupBy, renderGroupHeader } = useDataTableContext<TData>();
   const hasEmptyState = useDataTableStore((s) => s.hasEmptyState);
   const dataLength = useDataTableStore((s) => s.data.length);

   if (dataLength === 0 && hasEmptyState) return null;

   const columnCount = table.getVisibleLeafColumns().length;
   const rows = table.getRowModel().rows;

   return (
      <div className="rounded-md border overflow-hidden">
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
                              <TableHead
                                 className="w-[40px] px-2"
                                 key={header.id}
                              >
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
                           >
                              {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                 <Button
                                    className="h-8 gap-2 text-xs font-medium px-2"
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
               <DataTableBodyRows
                  columnCount={columnCount}
                  groupBy={groupBy}
                  renderGroupHeader={renderGroupHeader}
                  rows={rows}
               />
            </TableBody>
         </Table>
      </div>
   );
}
