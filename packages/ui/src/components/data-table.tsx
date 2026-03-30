"use client";

import {
   closestCenter,
   DndContext,
   type DragEndEvent,
   KeyboardSensor,
   MouseSensor,
   TouchSensor,
   type UniqueIdentifier,
   useSensor,
   useSensors,
} from "@dnd-kit/core";
import {
   restrictToHorizontalAxis,
   restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
   arrayMove,
   horizontalListSortingStrategy,
   SortableContext,
   useSortable,
   verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import {
   ArrowDown,
   ArrowUp,
   ArrowUpDown,
   GripVertical,
   Settings2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";

import { cn } from "../lib/utils";
import { Button } from "./button";
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
   columnVisibility?: VisibilityState;
   onColumnVisibilityChange?: (visibility: VisibilityState) => void;
   renderActions?: (props: { row: Row<TData> }) => React.ReactNode;
   reorderColumns?: boolean;
   reorderRows?: boolean;
   onRowOrderChange?: (data: TData[]) => void;
   groupBy?: (row: TData) => string;
   renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
}

// =============================================================================
// Helpers
// =============================================================================

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

function getPageNumbers(currentPage: number, totalPages: number): number[] {
   if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
   if (currentPage <= 3) return [1, 2, 3, 4, 5];
   if (currentPage >= totalPages - 2)
      return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
   return Array.from({ length: 5 }, (_, i) => currentPage - 2 + i);
}

// =============================================================================
// DnD — Row drag handle
// =============================================================================

function createDragHandleColumn<TData>(): ColumnDef<TData> {
   return {
      id: "drag-handle",
      header: () => null,
      cell: ({ row }) => <RowDragHandle rowId={row.id} />,
      size: 40,
      enableSorting: false,
      enableHiding: false,
   };
}

function RowDragHandle({ rowId }: { rowId: string }) {
   const { attributes, listeners } = useSortable({ id: rowId });
   return (
      <button
         type="button"
         className="flex size-8 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground"
         {...attributes}
         {...listeners}
      >
         <GripVertical className="size-4" />
      </button>
   );
}

// =============================================================================
// DnD — Sortable header cell (column reorder)
// =============================================================================

function SortableHeaderCell({
   headerId,
   colSpan,
   children,
}: {
   headerId: string;
   colSpan: number;
   children: React.ReactNode;
}) {
   const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
   } = useSortable({
      id: headerId,
   });

   return (
      <TableHead
         ref={setNodeRef}
         colSpan={colSpan}
         className={cn(isDragging && "opacity-50")}
         style={{
            position: "relative",
            transform: CSS.Translate.toString(transform),
            transition,
            zIndex: isDragging ? 1 : undefined,
         }}
      >
         <div className="flex items-center">
            <button
               type="button"
               className="flex size-6 cursor-grab items-center justify-center text-muted-foreground/50 hover:text-muted-foreground"
               {...attributes}
               {...listeners}
            >
               <GripVertical className="size-3.5" />
            </button>
            {children}
         </div>
      </TableHead>
   );
}

// =============================================================================
// DnD — Sortable body cell (column reorder)
// =============================================================================

function SortableCell({
   columnId,
   children,
}: {
   columnId: string;
   children: React.ReactNode;
}) {
   const { setNodeRef, transform, transition, isDragging } = useSortable({
      id: columnId,
   });

   return (
      <TableCell
         ref={setNodeRef}
         className={cn(isDragging && "opacity-50")}
         style={{
            position: "relative",
            transform: CSS.Translate.toString(transform),
            transition,
            zIndex: isDragging ? 1 : undefined,
         }}
      >
         {children}
      </TableCell>
   );
}

// =============================================================================
// DnD — Sortable row (row reorder)
// =============================================================================

function SortableRow({
   rowId,
   children,
   className,
   ...props
}: {
   rowId: string;
   children: React.ReactNode;
   className?: string;
} & React.HTMLAttributes<HTMLTableRowElement>) {
   const { setNodeRef, transform, transition, isDragging } = useSortable({
      id: rowId,
   });

   return (
      <TableRow
         ref={setNodeRef}
         className={cn(isDragging && "opacity-50", className)}
         style={{
            position: "relative",
            transform: CSS.Translate.toString(transform),
            transition,
            zIndex: isDragging ? 1 : undefined,
         }}
         {...props}
      >
         {children}
      </TableRow>
   );
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
               Exibindo
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
               {`Página ${currentPage} de ${totalPages}`}
            </div>
         </div>
         <div className="flex items-center gap-4">
            {onPageSizeChange && (
               <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                     Linhas por página
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
                           if (!isFirstPage && !hasSinglePage)
                              onPageChange(currentPage - 1);
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
                              if (!hasSinglePage) onPageChange(pageNum);
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
                           if (!isLastPage && !hasSinglePage)
                              onPageChange(currentPage + 1);
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
   columnVisibility = {},
   onColumnVisibilityChange,
   renderActions,
   reorderColumns = false,
   reorderRows = false,
   onRowOrderChange,
   groupBy,
   renderGroupHeader,
}: DataTableProps<TData, TValue>) {
   const [sorting, setSorting] = useState<SortingState>([]);
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
   const [internalRowSelection, setInternalRowSelection] =
      useState<RowSelectionState>({});

   const isControlled = controlledRowSelection !== undefined;
   const rowSelection = isControlled
      ? controlledRowSelection
      : internalRowSelection;

   const onRowSelectionChangeRef = useRef(onRowSelectionChange);
   useIsomorphicLayoutEffect(() => {
      onRowSelectionChangeRef.current = onRowSelectionChange;
   });

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

   const onColumnVisibilityChangeRef = useRef(onColumnVisibilityChange);
   useIsomorphicLayoutEffect(() => {
      onColumnVisibilityChangeRef.current = onColumnVisibilityChange;
   });

   const handleColumnVisibilityChange = useCallback(
      (
         updaterOrValue:
            | VisibilityState
            | ((old: VisibilityState) => VisibilityState),
      ) => {
         if (!onColumnVisibilityChangeRef.current) return;
         const next =
            typeof updaterOrValue === "function"
               ? updaterOrValue(columnVisibility)
               : updaterOrValue;
         onColumnVisibilityChangeRef.current(next);
      },
      [columnVisibility],
   );

   const hasActionsColumn = !!renderActions || !!onColumnVisibilityChange;

   const allColumns = useMemo(() => {
      const base: ColumnDef<TData, TValue>[] = [
         ...(reorderRows
            ? [createDragHandleColumn<TData>() as ColumnDef<TData, TValue>]
            : []),
         ...columns,
      ];
      if (!hasActionsColumn) return base;
      const actionsCol: ColumnDef<TData, unknown> = {
         id: "__actions",
         header: onColumnVisibilityChange ? () => null : undefined,
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
      return [...base, actionsCol as ColumnDef<TData, TValue>];
   }, [
      columns,
      hasActionsColumn,
      onColumnVisibilityChange,
      renderActions,
      reorderRows,
   ]);

   const [columnOrder, setColumnOrder] = useState<string[]>(() =>
      allColumns.map(
         (c) => (c as { accessorKey?: string }).accessorKey ?? c.id ?? "",
      ),
   );

   useEffect(() => {
      setColumnOrder((prev) => {
         const newIds = allColumns.map(
            (c) => (c as { accessorKey?: string }).accessorKey ?? c.id ?? "",
         );
         const kept = prev.filter((id) => newIds.includes(id));
         const added = newIds.filter((id) => !prev.includes(id));
         return [...kept, ...added];
      });
   }, [allColumns]);

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
      onColumnOrderChange: reorderColumns ? setColumnOrder : undefined,
      state: {
         columnFilters,
         columnVisibility,
         rowSelection,
         sorting,
         ...(reorderColumns ? { columnOrder } : {}),
      },
   });

   const columnCount = allColumns.length + (enableRowSelection ? 1 : 0);

   const isFixedColumn = (id: string) => id === "drag-handle";

   const columnIds = useMemo<UniqueIdentifier[]>(
      () =>
         table
            .getVisibleLeafColumns()
            .filter((col) => !isFixedColumn(col.id))
            .map((col) => col.id),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [table, columnOrder, columnVisibility],
   );

   const rowIds = useMemo<UniqueIdentifier[]>(
      () => table.getRowModel().rows.map((row) => row.id),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [table.getRowModel().rows],
   );

   const sensors = useSensors(
      useSensor(MouseSensor, {}),
      useSensor(TouchSensor, {}),
      useSensor(KeyboardSensor, {}),
   );

   function handleColumnDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
         setColumnOrder((prev) => {
            const oldIndex = prev.indexOf(active.id as string);
            const newIndex = prev.indexOf(over.id as string);
            return arrayMove(prev, oldIndex, newIndex);
         });
      }
   }

   function handleRowDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
         const getId = getRowId
            ? (row: TData) => getRowId(row)
            : (_row: TData, index: number) => String(index);
         const oldIndex = data.findIndex(
            (row, i) => getId(row, i) === active.id,
         );
         const newIndex = data.findIndex((row, i) => getId(row, i) === over.id);
         if (oldIndex !== -1 && newIndex !== -1) {
            onRowOrderChange?.(arrayMove([...data], oldIndex, newIndex));
         }
      }
   }

   // --- Header cells ---
   const renderHeaderCells = (
      headerGroup: ReturnType<typeof table.getHeaderGroups>[number],
   ) => {
      const selectionHead = enableRowSelection && (
         <TableHead className="w-[40px] px-2">
            <Checkbox
               aria-label="Select all"
               checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
               }
               onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(!!value)
               }
            />
         </TableHead>
      );

      const headers = headerGroup.headers.map((header) => {
         if (header.column.id === "__actions") {
            return (
               <TableHead className="w-0" key={header.id}>
                  {onColumnVisibilityChange ? (
                     <div className="flex items-center justify-end">
                        <ColumnVisibilityToggle
                           columnVisibility={columnVisibility}
                           onColumnVisibilityChange={
                              handleColumnVisibilityChange
                           }
                           table={table}
                        />
                     </div>
                  ) : null}
               </TableHead>
            );
         }

         const content =
            header.isPlaceholder ? null : header.column.getCanSort() ? (
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
                  ) : header.column.getIsSorted() === "desc" ? (
                     <ArrowDown className="size-4" />
                  ) : (
                     <ArrowUpDown className="size-4" />
                  )}
               </Button>
            ) : (
               flexRender(header.column.columnDef.header, header.getContext())
            );

         if (reorderColumns && !isFixedColumn(header.column.id)) {
            return (
               <SortableHeaderCell
                  key={header.id}
                  headerId={header.column.id}
                  colSpan={header.colSpan}
               >
                  {content}
               </SortableHeaderCell>
            );
         }

         return (
            <TableHead key={header.id} colSpan={header.colSpan}>
               {content}
            </TableHead>
         );
      });

      return (
         <>
            {selectionHead}
            {reorderColumns ? (
               <SortableContext
                  items={columnIds}
                  strategy={horizontalListSortingStrategy}
               >
                  {headers}
               </SortableContext>
            ) : (
               headers
            )}
         </>
      );
   };

   // --- Body cells ---
   const renderBodyCells = (
      row: ReturnType<typeof table.getRowModel>["rows"][number],
   ) => {
      const selectionCell = enableRowSelection && (
         <TableCell className="w-[40px] px-2">
            <Checkbox
               aria-label="Select row"
               checked={row.getIsSelected()}
               onCheckedChange={(value) => row.toggleSelected(!!value)}
            />
         </TableCell>
      );

      const cells = row.getVisibleCells().map((cell) => {
         const content = flexRender(
            cell.column.columnDef.cell,
            cell.getContext(),
         );

         if (reorderColumns && !isFixedColumn(cell.column.id)) {
            return (
               <SortableCell key={cell.id} columnId={cell.column.id}>
                  {content}
               </SortableCell>
            );
         }

         return (
            <TableCell
               className="truncate"
               key={cell.id}
               style={{ maxWidth: cell.column.columnDef.maxSize }}
            >
               {content}
            </TableCell>
         );
      });

      return (
         <>
            {selectionCell}
            {reorderColumns ? (
               <SortableContext
                  items={columnIds}
                  strategy={horizontalListSortingStrategy}
               >
                  {cells}
               </SortableContext>
            ) : (
               cells
            )}
         </>
      );
   };

   const activeReorderRows = reorderRows && !reorderColumns;

   useEffect(() => {
      if (reorderColumns && reorderRows) {
      }
      if (groupBy && reorderRows) {
      }
   }, [reorderColumns, reorderRows, groupBy]);

   // --- Single row ---
   const renderRow = (
      row: ReturnType<typeof table.getRowModel>["rows"][number],
   ) => {
      if (activeReorderRows) {
         return (
            <SortableRow
               key={row.id}
               rowId={row.id}
               className={cn(row.getIsSelected() && "bg-muted/50")}
               data-state={row.getIsSelected() ? "selected" : undefined}
            >
               {renderBodyCells(row)}
            </SortableRow>
         );
      }

      return (
         <TableRow
            key={row.id}
            className={cn(row.getIsSelected() && "bg-muted/50")}
            data-state={row.getIsSelected() ? "selected" : undefined}
         >
            {renderBodyCells(row)}
         </TableRow>
      );
   };

   // --- Body rows (with optional grouping) ---
   const renderBodyRows = () => {
      const rows = table.getRowModel().rows;

      if (!rows.length) {
         return (
            <TableRow>
               <TableCell className="h-24 text-center" colSpan={columnCount}>
                  Nenhum resultado encontrado.
               </TableCell>
            </TableRow>
         );
      }

      if (groupBy && renderGroupHeader) {
         const groups = new Map<string, Row<TData>[]>();
         for (const row of rows) {
            const key = groupBy(row.original);
            const existing = groups.get(key);
            if (existing) {
               existing.push(row);
            } else {
               groups.set(key, [row]);
            }
         }

         return Array.from(groups.entries()).flatMap(([key, groupRows]) => [
            <TableRow key={`group-${key}`} className="hover:bg-transparent">
               <TableCell
                  colSpan={columnCount}
                  className="py-2 px-4 bg-muted/30"
               >
                  {renderGroupHeader(key, groupRows)}
               </TableCell>
            </TableRow>,
            ...groupRows.map(renderRow),
         ]);
      }

      if (activeReorderRows) {
         return (
            <SortableContext
               items={rowIds}
               strategy={verticalListSortingStrategy}
            >
               {rows.map(renderRow)}
            </SortableContext>
         );
      }

      return rows.map(renderRow);
   };

   // --- Table content ---
   const tableContent = (
      <div className="rounded-md border">
         <Table>
            <TableHeader>
               {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                     {renderHeaderCells(headerGroup)}
                  </TableRow>
               ))}
            </TableHeader>
            <TableBody>{renderBodyRows()}</TableBody>
         </Table>
      </div>
   );

   const activeReorderColumns = reorderColumns;
   const needsDndContext = activeReorderColumns || activeReorderRows;
   const dndModifiers = activeReorderColumns
      ? [restrictToHorizontalAxis]
      : activeReorderRows
        ? [restrictToVerticalAxis]
        : [];
   const handleDragEnd = activeReorderColumns
      ? handleColumnDragEnd
      : handleRowDragEnd;

   return (
      <div>
         {needsDndContext ? (
            <DndContext
               collisionDetection={closestCenter}
               modifiers={dndModifiers}
               onDragEnd={handleDragEnd}
               sensors={sensors}
            >
               {tableContent}
            </DndContext>
         ) : (
            tableContent
         )}
         {pagination && <DataTablePagination {...pagination} />}
      </div>
   );
}
