"use client";

import {
   closestCenter,
   DndContext,
   type DragEndEvent,
   KeyboardSensor,
   PointerSensor,
   type UniqueIdentifier,
   useSensor,
   useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
   arrayMove,
   horizontalListSortingStrategy,
   SortableContext,
   useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
   type AccessorKeyColumnDef,
   type ColumnDef,
   type ColumnFiltersState,
   type ExpandedState,
   flexRender,
   getCoreRowModel,
   getExpandedRowModel,
   getFilteredRowModel,
   getSortedRowModel,
   type OnChangeFn,
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
   ChevronDown,
   ChevronRight,
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

export type DataTableStoredState = {
   columnOrder: string[];
   columnVisibility: VisibilityState;
};

interface DataTableProps<TData, TValue> {
   columns: ColumnDef<TData, TValue>[];
   data: TData[];
   getRowId: (row: TData) => string;
   sorting?: SortingState;
   onSortingChange?: OnChangeFn<SortingState>;
   columnFilters?: ColumnFiltersState;
   onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
   tableState?: DataTableStoredState | null;
   onTableStateChange?: (state: DataTableStoredState) => void;
   pagination?: DataTablePaginationProps;
   rowSelection?: RowSelectionState;
   onRowSelectionChange?: (selection: RowSelectionState) => void;
   renderActions?: (props: { row: Row<TData> }) => React.ReactNode;
   groupBy?: (row: TData) => string;
   renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
   getSubRows?: (row: TData) => TData[] | undefined;
}

// =============================================================================
// Helpers
// =============================================================================

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

function getColumnDefId<TData>(col: ColumnDef<TData, unknown>): string {
   if (col.id) return col.id;
   if ("accessorKey" in col && col.accessorKey != null) {
      return String((col as AccessorKeyColumnDef<TData, unknown>).accessorKey);
   }
   return "";
}

function getPageNumbers(currentPage: number, totalPages: number): number[] {
   if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
   if (currentPage <= 3) return [1, 2, 3, 4, 5];
   if (currentPage >= totalPages - 2)
      return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
   return Array.from({ length: 5 }, (_, i) => currentPage - 2 + i);
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
         className={cn("text-xs font-medium", isDragging && "opacity-50")}
         style={{
            position: "relative",
            transform: CSS.Translate.toString(transform),
            transition,
            zIndex: isDragging ? 1 : undefined,
         }}
      >
         <div className="group flex items-center">
            <button
               type="button"
               className="flex size-6 cursor-grab items-center justify-center opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-muted-foreground transition-opacity"
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
   getRowId,
   sorting,
   onSortingChange,
   columnFilters,
   onColumnFiltersChange,
   tableState,
   onTableStateChange,
   pagination,
   rowSelection: controlledRowSelection,
   onRowSelectionChange,
   renderActions,
   groupBy,
   renderGroupHeader,
   getSubRows,
}: DataTableProps<TData, TValue>) {
   const [internalSorting, setInternalSorting] = useState<SortingState>([]);
   const [internalColumnFilters, setInternalColumnFilters] =
      useState<ColumnFiltersState>([]);
   const [expanded, setExpanded] = useState<ExpandedState>(true);
   const [internalRowSelection, setInternalRowSelection] =
      useState<RowSelectionState>({});

   const effectiveSorting = sorting ?? internalSorting;
   const effectiveColumnFilters = columnFilters ?? internalColumnFilters;
   const effectiveOnSortingChange: OnChangeFn<SortingState> =
      onSortingChange ?? setInternalSorting;
   const effectiveOnColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      onColumnFiltersChange ?? setInternalColumnFilters;

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

   const effectiveColumnVisibility: VisibilityState =
      tableState?.columnVisibility ?? {};

   const effectiveColumnVisibilityRef = useRef(effectiveColumnVisibility);
   useIsomorphicLayoutEffect(() => {
      effectiveColumnVisibilityRef.current = effectiveColumnVisibility;
   });

   const onTableStateChangeRef = useRef(onTableStateChange);
   useIsomorphicLayoutEffect(() => {
      onTableStateChangeRef.current = onTableStateChange;
   });

   const columnOrderRef = useRef<string[]>([]);

   const handleColumnVisibilityChange = useCallback(
      (
         updaterOrValue:
            | VisibilityState
            | ((old: VisibilityState) => VisibilityState),
      ) => {
         const next =
            typeof updaterOrValue === "function"
               ? updaterOrValue(effectiveColumnVisibility)
               : updaterOrValue;
         onTableStateChangeRef.current?.({
            columnOrder: columnOrderRef.current,
            columnVisibility: next,
         });
      },
      [effectiveColumnVisibility],
   );

   const allColumns = useMemo(() => {
      const actionsCol: ColumnDef<TData, unknown> = {
         id: "__actions",
         header: () => null,
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
      return [...columns, actionsCol as ColumnDef<TData, TValue>];
   }, [columns, renderActions]);

   const isFixedColumn = (id: string) => id === "__actions";

   const [columnOrder, setColumnOrder] = useState<string[]>(() => {
      const draggableIds = allColumns
         .filter((c) => !isFixedColumn(getColumnDefId(c)))
         .map((c) => getColumnDefId(c))
         .filter(Boolean);
      if (tableState?.columnOrder) {
         return tableState.columnOrder.filter((id) =>
            draggableIds.includes(id),
         );
      }
      return draggableIds;
   });

   useEffect(() => {
      setColumnOrder((prev) => {
         const draggableIds = allColumns
            .filter((c) => !isFixedColumn(getColumnDefId(c)))
            .map((c) => getColumnDefId(c))
            .filter(Boolean);
         const kept = prev.filter((id) => draggableIds.includes(id));
         const added = draggableIds.filter((id) => !prev.includes(id));
         return [...kept, ...added];
      });
   }, [allColumns]);

   columnOrderRef.current = columnOrder;

   const columnOrderMounted = useRef(false);
   useEffect(() => {
      if (!columnOrderMounted.current) {
         columnOrderMounted.current = true;
         return;
      }
      onTableStateChangeRef.current?.({
         columnOrder,
         columnVisibility: effectiveColumnVisibilityRef.current,
      });
   }, [columnOrder]);

   const table = useReactTable({
      columns: allColumns,
      data,
      enableRowSelection: true,
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getRowId: (originalRow) => getRowId(originalRow),
      getSortedRowModel: getSortedRowModel(),
      getSubRows,
      onColumnFiltersChange: effectiveOnColumnFiltersChange,
      onColumnVisibilityChange: handleColumnVisibilityChange,
      onExpandedChange: setExpanded,
      onRowSelectionChange: handleRowSelectionChange,
      onSortingChange: effectiveOnSortingChange,
      onColumnOrderChange: setColumnOrder,
      state: {
         columnFilters: effectiveColumnFilters,
         columnVisibility: effectiveColumnVisibility,
         expanded,
         rowSelection,
         sorting: effectiveSorting,
         columnOrder,
      },
   });

   const columnCount = table.getVisibleLeafColumns().length + 1;

   const columnIds = useMemo<UniqueIdentifier[]>(
      () =>
         table
            .getVisibleLeafColumns()
            .filter((col) => !isFixedColumn(col.id))
            .map((col) => col.id),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [table, columnOrder, effectiveColumnVisibility],
   );

   const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
      useSensor(KeyboardSensor, {}),
   );

   function handleColumnDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
         setColumnOrder((prev) => {
            const oldIndex = prev.indexOf(String(active.id));
            const newIndex = prev.indexOf(String(over.id));
            return arrayMove(prev, oldIndex, newIndex);
         });
      }
   }

   // --- Header cells ---
   const renderHeaderCells = (
      headerGroup: ReturnType<typeof table.getHeaderGroups>[number],
   ) => {
      const selectionHead = (
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
                  <div className="flex items-center justify-end">
                     <ColumnVisibilityToggle
                        columnVisibility={effectiveColumnVisibility}
                        onColumnVisibilityChange={handleColumnVisibilityChange}
                        table={table}
                     />
                  </div>
               </TableHead>
            );
         }

         const content =
            header.isPlaceholder ? null : header.column.getCanSort() ? (
               <Button
                  className="h-8 gap-1.5 text-xs font-medium px-2"
                  onClick={header.column.getToggleSortingHandler()}
                  variant="ghost"
               >
                  {flexRender(
                     header.column.columnDef.header,
                     header.getContext(),
                  )}
                  {header.column.getIsSorted() === "asc" ? (
                     <ArrowUp className="size-3.5" />
                  ) : header.column.getIsSorted() === "desc" ? (
                     <ArrowDown className="size-3.5" />
                  ) : (
                     <ArrowUpDown className="size-3.5 opacity-50" />
                  )}
               </Button>
            ) : (
               <span className="px-2 text-xs font-medium">
                  {flexRender(
                     header.column.columnDef.header,
                     header.getContext(),
                  )}
               </span>
            );

         if (!isFixedColumn(header.column.id)) {
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
            <TableHead
               key={header.id}
               colSpan={header.colSpan}
               className="text-xs font-medium"
            >
               {content}
            </TableHead>
         );
      });

      return (
         <>
            {selectionHead}
            <SortableContext
               items={columnIds}
               strategy={horizontalListSortingStrategy}
            >
               {headers}
            </SortableContext>
         </>
      );
   };

   // --- Body cells ---
   const renderBodyCells = (
      row: ReturnType<typeof table.getRowModel>["rows"][number],
   ) => {
      if (row.depth > 0) {
         const visibleCells = row.getVisibleCells();
         const cells = visibleCells.map((cell, i) => (
            <TableCell
               className={cn("truncate text-sm", i === 0 && "pl-6")}
               key={cell.id}
               style={{ maxWidth: cell.column.columnDef.maxSize }}
            >
               {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
         ));
         return (
            <>
               <TableCell className="w-[40px] p-0" />
               {cells}
            </>
         );
      }

      const selectionCell = (
         <TableCell className="w-[40px] px-2">
            <div className="flex items-center gap-1">
               {getSubRows &&
                  (row.getCanExpand() ? (
                     <button
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => row.toggleExpanded()}
                        type="button"
                     >
                        {row.getIsExpanded() ? (
                           <ChevronDown className="size-3.5" />
                        ) : (
                           <ChevronRight className="size-3.5" />
                        )}
                     </button>
                  ) : (
                     <span className="size-3.5 shrink-0" />
                  ))}
               <Checkbox
                  aria-label="Select row"
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
               />
            </div>
         </TableCell>
      );

      const cells = row.getVisibleCells().map((cell) => (
         <TableCell
            className="truncate"
            key={cell.id}
            style={{ maxWidth: cell.column.columnDef.maxSize }}
         >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
         </TableCell>
      ));

      return (
         <>
            {selectionCell}
            {cells}
         </>
      );
   };

   // --- Single row ---
   const renderRow = (
      row: ReturnType<typeof table.getRowModel>["rows"][number],
   ) => (
      <TableRow
         key={row.id}
         className={cn("bg-card", row.getIsSelected() && "bg-muted/50")}
         data-state={row.getIsSelected() ? "selected" : undefined}
      >
         {renderBodyCells(row)}
      </TableRow>
   );

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
                  className="py-2 px-4 bg-muted text-sm font-medium text-foreground"
               >
                  {renderGroupHeader(key, groupRows)}
               </TableCell>
            </TableRow>,
            ...groupRows.map(renderRow),
         ]);
      }

      return rows.map(renderRow);
   };

   return (
      <div>
         <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={handleColumnDragEnd}
            sensors={sensors}
         >
            <div className="rounded-md border overflow-hidden">
               <Table className="border-separate border-spacing-0">
                  <TableHeader>
                     {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow
                           key={headerGroup.id}
                           className="bg-muted/50 hover:bg-muted/50"
                        >
                           {renderHeaderCells(headerGroup)}
                        </TableRow>
                     ))}
                  </TableHeader>
                  <TableBody>{renderBodyRows()}</TableBody>
               </Table>
            </div>
         </DndContext>
         {pagination && <DataTablePagination {...pagination} />}
      </div>
   );
}
