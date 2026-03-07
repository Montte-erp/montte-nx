"use client";

import {
   type ColumnDef,
   type ColumnFiltersState,
   flexRender,
   getCoreRowModel,
   getFilteredRowModel,
   getSortedRowModel,
   type Row,
   type RowSelectionState,
   type SortingState,
   type Table as TanStackTable,
   useReactTable,
   type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Settings2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import {
   Card,
   CardAction,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from "./card";
import { Checkbox } from "./checkbox";
import {
   DropdownMenu,
   DropdownMenuCheckboxItem,
   DropdownMenuContent,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "./dropdown-menu";
import {
   Pagination,
   PaginationContent,
   PaginationItem,
   PaginationLink,
   PaginationNext,
   PaginationPrevious,
} from "./pagination";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "./select";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "./table";

// =============================================================================
// Types
// =============================================================================

interface DataTablePaginationProps {
   currentPage: number;
   totalPages: number;
   totalCount: number;
   pageSize: number;
   onPageChange: (page: number) => void;
   onPageSizeChange?: (size: number) => void;
   pageSizeOptions?: number[];
}

interface DataTableProps<TData, TValue> {
   columns: ColumnDef<TData, TValue>[];
   data: TData[];
   pagination?: DataTablePaginationProps;
   enableRowSelection?: boolean;
   rowSelection?: RowSelectionState;
   onRowSelectionChange?: (selection: RowSelectionState) => void;
   getRowId?: (row: TData) => string;
   /** When provided, enables column visibility toggle persisted in localStorage under this key. */
   columnVisibilityKey?: string;
   /** Render row actions in the last column. The header shows the column visibility config icon. */
   renderActions?: (props: { row: Row<TData> }) => React.ReactNode;
   /** Controls layout: 'table' (default) or 'card' (dynamic cards from column definitions). */
   view?: "table" | "card";
}

// =============================================================================
// Helpers
// =============================================================================

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

function readVisibilityFromStorage(key: string | undefined): VisibilityState {
   if (!key) return {};
   try {
      const stored = localStorage.getItem(`dt-col-vis:${key}`);
      return stored ? JSON.parse(stored) : {};
   } catch {
      return {};
   }
}

function writeVisibilityToStorage(
   key: string | undefined,
   state: VisibilityState,
) {
   if (!key) return;
   try {
      localStorage.setItem(`dt-col-vis:${key}`, JSON.stringify(state));
   } catch {
      // ignore quota errors
   }
}

function getPageNumbers(currentPage: number, totalPages: number): number[] {
   if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
   }
   if (currentPage <= 3) {
      return [1, 2, 3, 4, 5];
   }
   if (currentPage >= totalPages - 2) {
      return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
   }
   return Array.from({ length: 5 }, (_, i) => currentPage - 2 + i);
}

// =============================================================================
// Column Visibility Toggle
// =============================================================================

function ColumnVisibilityToggle<TData>({
   table,
   columnVisibility,
   onColumnVisibilityChange,
}: {
   table: TanStackTable<TData>;
   columnVisibility: VisibilityState;
   onColumnVisibilityChange: (
      updater: VisibilityState | ((old: VisibilityState) => VisibilityState),
   ) => void;
}) {
   const toggleableColumns = table
      .getAllColumns()
      .filter((col) => col.getCanHide() && col.id !== "__actions");

   if (toggleableColumns.length === 0) return null;

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button tooltip="Configurar colunas" variant="outline">
               <Settings2 className="size-4" />
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
            <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {toggleableColumns.map((column) => (
               <DropdownMenuCheckboxItem
                  checked={columnVisibility[column.id] !== false}
                  key={column.id}
                  onCheckedChange={(value) =>
                     onColumnVisibilityChange((prev) => ({
                        ...prev,
                        [column.id]: !!value,
                     }))
                  }
                  onSelect={(e) => e.preventDefault()}
               >
                  {typeof column.columnDef.header === "string"
                     ? column.columnDef.header
                     : column.id}
               </DropdownMenuCheckboxItem>
            ))}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}

// =============================================================================
// Pagination
// =============================================================================

function DataTablePagination({
   currentPage,
   totalPages,
   totalCount: _totalCount,
   pageSize,
   onPageChange,
   onPageSizeChange,
   pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: DataTablePaginationProps) {
   const isFirstPage = currentPage === 1;
   const isLastPage = currentPage === totalPages || totalPages === 0;
   const hasSinglePage = totalPages <= 1;
   const pageNumbers = useMemo(
      () => getPageNumbers(currentPage, totalPages),
      [currentPage, totalPages],
   );

   return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
         <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground hidden md:block">
               {"Exibindo"}
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
               {`Página ${currentPage} de ${totalPages}`}
            </div>
         </div>
         <div className="flex items-center gap-4">
            {onPageSizeChange && (
               <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                     {"Linhas por página"}
                  </span>
                  <Select
                     onValueChange={(value) => onPageSizeChange(Number(value))}
                     value={String(pageSize)}
                  >
                     <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={String(pageSize)} />
                     </SelectTrigger>
                     <SelectContent side="top">
                        {pageSizeOptions.map((size) => (
                           <SelectItem key={size} value={String(size)}>
                              {size}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
            )}
            <Pagination className="w-auto">
               <PaginationContent>
                  <PaginationItem>
                     <PaginationPrevious
                        aria-disabled={isFirstPage || hasSinglePage}
                        className={cn(
                           (isFirstPage || hasSinglePage) &&
                              "pointer-events-none opacity-50",
                        )}
                        href="#"
                        onClick={(e) => {
                           e.preventDefault();
                           if (!isFirstPage && !hasSinglePage) {
                              onPageChange(currentPage - 1);
                           }
                        }}
                     />
                  </PaginationItem>

                  {pageNumbers.map((pageNum) => (
                     <PaginationItem key={pageNum}>
                        <PaginationLink
                           aria-disabled={hasSinglePage}
                           className={cn(
                              hasSinglePage && "pointer-events-none opacity-50",
                           )}
                           href="#"
                           isActive={pageNum === currentPage}
                           onClick={(e) => {
                              e.preventDefault();
                              if (!hasSinglePage) {
                                 onPageChange(pageNum);
                              }
                           }}
                        >
                           {pageNum}
                        </PaginationLink>
                     </PaginationItem>
                  ))}

                  <PaginationItem>
                     <PaginationNext
                        aria-disabled={isLastPage || hasSinglePage}
                        className={cn(
                           (isLastPage || hasSinglePage) &&
                              "pointer-events-none opacity-50",
                        )}
                        href="#"
                        onClick={(e) => {
                           e.preventDefault();
                           if (!isLastPage && !hasSinglePage) {
                              onPageChange(currentPage + 1);
                           }
                        }}
                     />
                  </PaginationItem>
               </PaginationContent>
            </Pagination>
         </div>
      </div>
   );
}

// =============================================================================
// DataTable
// =============================================================================

export function DataTable<TData, TValue>({
   columns,
   data,
   pagination,
   enableRowSelection = false,
   rowSelection: controlledRowSelection,
   onRowSelectionChange,
   getRowId,
   columnVisibilityKey,
   renderActions,
   view = "table",
}: DataTableProps<TData, TValue>) {
   const [sorting, setSorting] = useState<SortingState>([]);
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
   const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
      () => readVisibilityFromStorage(columnVisibilityKey),
   );
   const [internalRowSelection, setInternalRowSelection] =
      useState<RowSelectionState>({});

   const isControlled = controlledRowSelection !== undefined;
   const rowSelection = isControlled
      ? controlledRowSelection
      : internalRowSelection;

   const onRowSelectionChangeRef = useRef(onRowSelectionChange);
   onRowSelectionChangeRef.current = onRowSelectionChange;

   const handleRowSelectionChange = useCallback(
      (
         updaterOrValue:
            | RowSelectionState
            | ((old: RowSelectionState) => RowSelectionState),
      ) => {
         if (isControlled) {
            const resolve = (prev: RowSelectionState) =>
               typeof updaterOrValue === "function"
                  ? updaterOrValue(prev)
                  : updaterOrValue;
            onRowSelectionChangeRef.current?.(resolve(controlledRowSelection));
         } else {
            setInternalRowSelection((prev) => {
               const next =
                  typeof updaterOrValue === "function"
                     ? updaterOrValue(prev)
                     : updaterOrValue;
               onRowSelectionChangeRef.current?.(next);
               return next;
            });
         }
      },
      [isControlled, controlledRowSelection],
   );

   const handleColumnVisibilityChange = useCallback(
      (
         updaterOrValue:
            | VisibilityState
            | ((old: VisibilityState) => VisibilityState),
      ) => {
         setColumnVisibility((prev) => {
            const next =
               typeof updaterOrValue === "function"
                  ? updaterOrValue(prev)
                  : updaterOrValue;
            writeVisibilityToStorage(columnVisibilityKey, next);
            return next;
         });
      },
      [columnVisibilityKey],
   );

   const hasActionsColumn = !!renderActions || !!columnVisibilityKey;

   const allColumns = useMemo(() => {
      if (!hasActionsColumn) return columns;
      const actionsCol: ColumnDef<TData, unknown> = {
         id: "__actions",
         header: columnVisibilityKey
            ? () => null // placeholder — header rendered via headerGroup
            : undefined,
         cell: renderActions
            ? ({ row }) => (
                 <div className="flex items-center justify-end gap-1">
                    {renderActions({ row })}
                 </div>
              )
            : undefined,
         enableSorting: false,
         enableHiding: false,
      };
      return [...columns, actionsCol];
   }, [columns, hasActionsColumn, columnVisibilityKey, renderActions]);

   const table = useReactTable({
      columns: allColumns,
      data,
      enableRowSelection,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getRowId: getRowId
         ? (originalRow) => getRowId(originalRow)
         : (_row, index) => String(index),
      getSortedRowModel: getSortedRowModel(),
      onColumnFiltersChange: setColumnFilters,
      onColumnVisibilityChange: handleColumnVisibilityChange,
      onRowSelectionChange: handleRowSelectionChange,
      onSortingChange: setSorting,
      state: {
         columnFilters,
         columnVisibility,
         rowSelection,
         sorting,
      },
   });

   const columnCount = allColumns.length + (enableRowSelection ? 1 : 0);

   // --- Card layout ---
   if (view === "card") {
      return (
         <div className="space-y-3">
            {/* Toolbar: select-all + column visibility */}
            <div className="flex items-center justify-between gap-2">
               <div className="flex items-center gap-2">
                  {enableRowSelection && (
                     <>
                        <Checkbox
                           aria-label="Selecionar todos"
                           checked={
                              table.getIsAllPageRowsSelected() ||
                              (table.getIsSomePageRowsSelected() &&
                                 "indeterminate")
                           }
                           onCheckedChange={(value) =>
                              table.toggleAllPageRowsSelected(!!value)
                           }
                        />
                        <span className="text-sm text-muted-foreground">
                           Selecionar todos
                        </span>
                     </>
                  )}
               </div>
               {columnVisibilityKey && (
                  <ColumnVisibilityToggle
                     columnVisibility={columnVisibility}
                     onColumnVisibilityChange={handleColumnVisibilityChange}
                     table={table}
                  />
               )}
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => {
                     const visibleCells = row
                        .getVisibleCells()
                        .filter((cell) => cell.column.id !== "__actions");

                     const [primaryCell, secondaryCell, ...restCells] =
                        visibleCells;

                     return (
                        <Card
                           className={cn(
                              "gap-4",
                              row.getIsSelected() && "ring-2 ring-primary",
                           )}
                           key={row.id}
                        >
                           <CardHeader>
                              {primaryCell && (
                                 <CardTitle>
                                    {flexRender(
                                       primaryCell.column.columnDef.cell,
                                       primaryCell.getContext(),
                                    )}
                                 </CardTitle>
                              )}
                              {secondaryCell && (
                                 <CardDescription>
                                    {flexRender(
                                       secondaryCell.column.columnDef.cell,
                                       secondaryCell.getContext(),
                                    )}
                                 </CardDescription>
                              )}
                              {enableRowSelection && (
                                 <CardAction>
                                    <Checkbox
                                       aria-label="Selecionar"
                                       checked={row.getIsSelected()}
                                       onCheckedChange={(value) =>
                                          row.toggleSelected(!!value)
                                       }
                                    />
                                 </CardAction>
                              )}
                           </CardHeader>

                           {restCells.length > 0 && (
                              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
                                 {restCells.map((cell) => {
                                    const header = cell.column.columnDef.header;
                                    const label =
                                       typeof header === "string"
                                          ? header
                                          : null;

                                    return (
                                       <div className="min-w-0" key={cell.id}>
                                          {label && (
                                             <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                                                {label}
                                             </p>
                                          )}
                                          <div className="text-sm truncate">
                                             {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                             )}
                                          </div>
                                       </div>
                                    );
                                 })}
                              </CardContent>
                           )}

                           {renderActions && (
                              <CardFooter className="justify-end gap-1">
                                 {renderActions({ row })}
                              </CardFooter>
                           )}
                        </Card>
                     );
                  })
               ) : (
                  <div className="col-span-full py-8 text-center text-muted-foreground">
                     Nenhum resultado encontrado.
                  </div>
               )}
            </div>
            {pagination && <DataTablePagination {...pagination} />}
         </div>
      );
   }

   // --- Desktop layout ---
   return (
      <div>
         <div className="rounded-md border">
            <Table>
               <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                     <TableRow key={headerGroup.id}>
                        {enableRowSelection && (
                           <TableHead className="w-[40px] px-2">
                              <Checkbox
                                 aria-label="Select all"
                                 checked={
                                    table.getIsAllPageRowsSelected() ||
                                    (table.getIsSomePageRowsSelected() &&
                                       "indeterminate")
                                 }
                                 onCheckedChange={(value) =>
                                    table.toggleAllPageRowsSelected(!!value)
                                 }
                              />
                           </TableHead>
                        )}
                        {headerGroup.headers.map((header) => (
                           <TableHead
                              key={header.id}
                              {...(header.column.id === "__actions"
                                 ? { className: "w-0" }
                                 : {})}
                           >
                              {header.column.id === "__actions" ? (
                                 columnVisibilityKey ? (
                                    <div className="flex items-center justify-end">
                                       <ColumnVisibilityToggle
                                          columnVisibility={columnVisibility}
                                          onColumnVisibilityChange={
                                             handleColumnVisibilityChange
                                          }
                                          table={table}
                                       />
                                    </div>
                                 ) : null
                              ) : header.isPlaceholder ? null : header.column.getCanSort() ? (
                                 <Button
                                    className="h-8 gap-2"
                                    onClick={header.column.getToggleSortingHandler()}
                                    variant="ghost"
                                 >
                                    {flexRender(
                                       header.column.columnDef.header,
                                       header.getContext(),
                                    )}
                                    {header.column.getIsSorted() === "asc" ? (
                                       <ArrowUp className="size-4" />
                                    ) : header.column.getIsSorted() ===
                                      "desc" ? (
                                       <ArrowDown className="size-4" />
                                    ) : (
                                       <ArrowUpDown className="size-4" />
                                    )}
                                 </Button>
                              ) : (
                                 flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                 )
                              )}
                           </TableHead>
                        ))}
                     </TableRow>
                  ))}
               </TableHeader>
               <TableBody>
                  {table.getRowModel().rows?.length ? (
                     table.getRowModel().rows.map((row) => (
                        <TableRow
                           className={cn(row.getIsSelected() && "bg-muted/50")}
                           data-state={row.getIsSelected() && "selected"}
                           key={row.id}
                        >
                           {enableRowSelection && (
                              <TableCell className="w-[40px] px-2">
                                 <Checkbox
                                    aria-label="Select row"
                                    checked={row.getIsSelected()}
                                    onCheckedChange={(value) =>
                                       row.toggleSelected(!!value)
                                    }
                                 />
                              </TableCell>
                           )}
                           {row.getVisibleCells().map((cell) => (
                              <TableCell
                                 className="truncate"
                                 key={cell.id}
                                 style={{
                                    maxWidth: cell.column.columnDef.maxSize,
                                 }}
                              >
                                 {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext(),
                                 )}
                              </TableCell>
                           ))}
                        </TableRow>
                     ))
                  ) : (
                     <TableRow>
                        <TableCell
                           className="h-24 text-center"
                           colSpan={columnCount}
                        >
                           Nenhum resultado encontrado.
                        </TableCell>
                     </TableRow>
                  )}
               </TableBody>
            </Table>
         </div>
         {pagination && <DataTablePagination {...pagination} />}
      </div>
   );
}
