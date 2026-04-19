"use client";

import * as React from "react";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { useForm } from "@tanstack/react-form";
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
   type Column,
   type ColumnDef,
   type ColumnFiltersState,
   type ColumnPinningState,
   type ExpandedState,
   flexRender,
   getFacetedMinMaxValues,
   getFacetedRowModel,
   getFacetedUniqueValues,
   getCoreRowModel,
   getExpandedRowModel,
   type OnChangeFn,
   type Row,
   type RowData,
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
   Pin,
   PinOff,
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
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "./select";
import { Textarea } from "./textarea";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "./table";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "./tooltip";

declare module "@tanstack/react-table" {
   // oxlint-ignore @typescript-eslint/no-unused-vars
   interface ColumnMeta<TData extends RowData, TValue> {
      label?: string;
      filterVariant?: "text" | "select" | "range" | "date";
      align?: "left" | "center" | "right";
      exportable?: boolean;
      isEditable?: boolean;
      cellComponent?: "text" | "textarea" | "select";
      editMode?: "inline" | "popover";
      editOptions?: Array<{ label: string; value: string }>;
      editSchema?: StandardSchemaV1<any>;
      onSave?: (rowId: string, value: unknown) => Promise<void>;
      isEditableForRow?: (row: TData) => boolean;
   }
}

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
   columnPinning?: ColumnPinningState;
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
   renderExpandedRow?: (props: { row: Row<TData> }) => React.ReactNode;
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

function isFixedColumn(id: string): boolean {
   return id === "__actions";
}

function getPinningOffsets<TData>(column: Column<TData>): React.CSSProperties {
   const isPinned = column.getIsPinned();
   if (!isPinned) return {};
   return {
      left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
      right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
   };
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
// DnD — Sortable header cell
// =============================================================================

// =============================================================================
// Editable cell
// =============================================================================

function EditableCell({
   value: initialValue,
   cellComponent,
   editMode = "inline",
   options,
   schema,
   onSave,
   rowId,
   cellId,
}: {
   value: unknown;
   cellComponent: "text" | "textarea" | "select";
   editMode?: "inline" | "popover";
   options?: Array<{ label: string; value: string }>;
   schema?: StandardSchemaV1<any>;
   onSave?: (rowId: string, value: unknown) => Promise<void>;
   rowId: string;
   cellId: string;
}) {
   const [editing, setEditing] = useState(false);
   const [localValue, setLocalValue] = useState<unknown>(initialValue);
   const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

   useEffect(() => {
      setLocalValue(initialValue);
   }, [initialValue]);

   useEffect(() => {
      if (editing && editMode === "inline") {
         inputRef.current?.focus();
      }
   }, [editing, editMode]);

   const form = useForm({
      defaultValues: { value: String(localValue ?? "") },
      onSubmit: async ({ value }: { value: { value: string } }) => {
         const prev = localValue;
         setLocalValue(value.value);
         setEditing(false);
         try {
            await onSave?.(rowId, value.value);
         } catch {
            setLocalValue(prev);
         }
      },
   });

   const cancel = useCallback(() => {
      form.reset();
      setEditing(false);
   }, [form]);

   const focusNext = useCallback(() => {
      const all = Array.from(
         document.querySelectorAll<HTMLElement>("[data-editable-cell]"),
      );
      const idx = all.findIndex((el) => el.dataset.editableCellId === cellId);
      all[idx + 1]?.click();
   }, [cellId]);

   const displayValue = String(localValue ?? "");

   const displayNode = (
      <div
         data-editable-cell
         data-editable-cell-id={cellId}
         className="cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 min-h-[1.5rem] flex items-center w-full text-sm"
         onClick={() => setEditing(true)}
         onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setEditing(true);
         }}
         role="button"
         tabIndex={0}
      >
         {cellComponent === "select"
            ? (options?.find((o) => o.value === displayValue)?.label ??
              displayValue)
            : displayValue || (
                 <span className="text-muted-foreground/40">—</span>
              )}
      </div>
   );

   if (!editing) return displayNode;

   const editFields = (
      <form
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         {cellComponent === "select" && (
            <Select
               value={String(localValue ?? "")}
               onValueChange={(v) => {
                  setLocalValue(v);
                  setEditing(false);
                  onSave?.(rowId, v).catch(() => setLocalValue(localValue));
               }}
               open
               onOpenChange={(open) => {
                  if (!open) cancel();
               }}
            >
               <SelectTrigger className="h-7 text-sm">
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  {options?.map((opt) => (
                     <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         )}

         {cellComponent === "text" && (
            <form.Field
               name="value"
               validators={
                  schema ? { onChange: schema, onBlur: schema } : undefined
               }
            >
               {(field) => (
                  <div className="flex flex-col gap-2">
                     <input
                        ref={inputRef}
                        type="text"
                        aria-invalid={
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0
                        }
                        className="h-7 w-full rounded border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 aria-invalid:border-destructive"
                        defaultValue={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={(e) => {
                           field.handleChange(e.target.value);
                           field.handleBlur();
                           form.handleSubmit();
                        }}
                        onKeyDown={(e) => {
                           if (e.key === "Escape") {
                              e.preventDefault();
                              cancel();
                           }
                           if (e.key === "Tab") {
                              e.preventDefault();
                              field.handleChange(
                                 (e.target as HTMLInputElement).value,
                              );
                              form.handleSubmit().then(focusNext);
                           }
                        }}
                     />
                     {field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0 && (
                           <span className="text-xs text-destructive">
                              {field.state.meta.errors[0]?.message}
                           </span>
                        )}
                  </div>
               )}
            </form.Field>
         )}

         {cellComponent === "textarea" && (
            <div className="flex flex-col gap-2">
               <form.Field
                  name="value"
                  validators={
                     schema ? { onChange: schema, onBlur: schema } : undefined
                  }
               >
                  {(field) => (
                     <>
                        <Textarea
                           ref={inputRef}
                           aria-invalid={
                              field.state.meta.isTouched &&
                              field.state.meta.errors.length > 0
                           }
                           className="min-h-[80px] text-sm resize-none aria-invalid:border-destructive"
                           defaultValue={field.state.value}
                           onChange={(e) => field.handleChange(e.target.value)}
                           onBlur={() => field.handleBlur()}
                           onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                 e.preventDefault();
                                 cancel();
                              }
                              if (
                                 e.key === "Enter" &&
                                 (e.ctrlKey || e.metaKey)
                              ) {
                                 e.preventDefault();
                                 field.handleChange(
                                    (e.target as HTMLTextAreaElement).value,
                                 );
                                 form.handleSubmit();
                              }
                           }}
                           placeholder="Adicionar descrição..."
                        />
                        {field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0 && (
                              <span className="text-xs text-destructive">
                                 {field.state.meta.errors[0]?.message}
                              </span>
                           )}
                     </>
                  )}
               </form.Field>
               <div className="flex justify-end gap-2">
                  <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={cancel}
                  >
                     Cancelar
                  </Button>
                  <Button type="submit" size="sm">
                     Salvar
                  </Button>
               </div>
            </div>
         )}
      </form>
   );

   if (editMode === "popover") {
      return (
         <Popover
            open
            onOpenChange={(open) => {
               if (!open) cancel();
            }}
         >
            <PopoverTrigger asChild>{displayNode}</PopoverTrigger>
            <PopoverContent
               className="w-80"
               onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
               }}
            >
               {editFields}
            </PopoverContent>
         </Popover>
      );
   }

   return editFields;
}

function SortableHeaderCell<TData>({
   headerId,
   colSpan,
   children,
   pinningStyle,
   isPinned,
   align,
   column,
}: {
   headerId: string;
   colSpan: number;
   children: React.ReactNode;
   pinningStyle?: React.CSSProperties;
   isPinned?: false | "left" | "right";
   align?: "left" | "center" | "right";
   column: Column<TData>;
}) {
   const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
   } = useSortable({ id: headerId });

   return (
      <TableHead
         ref={setNodeRef}
         colSpan={colSpan}
         className={cn(
            "text-xs font-medium",
            isDragging && "opacity-50",
            isPinned ? "sticky bg-inherit" : "relative",
            isDragging ? (isPinned ? "z-[2]" : "z-[1]") : isPinned && "z-[1]",
            align === "right" && "text-right",
            align === "center" && "text-center",
         )}
         style={{
            ...pinningStyle,
            transform: CSS.Translate.toString(transform),
            transition,
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
            <TooltipProvider>
               <Tooltip>
                  <TooltipTrigger asChild>
                     <button
                        type="button"
                        className={cn(
                           "ml-1 flex size-5 items-center justify-center rounded transition-opacity",
                           isPinned
                              ? "opacity-100 text-muted-foreground"
                              : "opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-muted-foreground",
                        )}
                        onClick={() => column.pin(isPinned ? false : "left")}
                     >
                        {isPinned ? (
                           <PinOff className="size-3" />
                        ) : (
                           <Pin className="size-3" />
                        )}
                     </button>
                  </TooltipTrigger>
                  <TooltipContent>
                     {isPinned ? "Desafixar coluna" : "Fixar coluna"}
                  </TooltipContent>
               </Tooltip>
            </TooltipProvider>
         </div>
      </TableHead>
   );
}

// =============================================================================
// Column visibility toggle
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
// Header row
// =============================================================================

function DataTableHeaderRow<TData>({
   headerGroup,
   columnIds,
   effectiveColumnVisibility,
   onColumnVisibilityChange,
   table,
}: {
   headerGroup: ReturnType<TanStackTable<TData>["getHeaderGroups"]>[number];
   columnIds: UniqueIdentifier[];
   effectiveColumnVisibility: VisibilityState;
   onColumnVisibilityChange: (
      updater: VisibilityState | ((old: VisibilityState) => VisibilityState),
   ) => void;
   table: TanStackTable<TData>;
}) {
   const headers = headerGroup.headers.map((header) => {
      if (header.column.id === "__actions") {
         return (
            <TableHead className="w-0" key={header.id}>
               <div className="flex items-center justify-end">
                  <ColumnVisibilityToggle
                     columnVisibility={effectiveColumnVisibility}
                     onColumnVisibilityChange={onColumnVisibilityChange}
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
               {flexRender(header.column.columnDef.header, header.getContext())}
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
               {flexRender(header.column.columnDef.header, header.getContext())}
            </span>
         );

      if (!isFixedColumn(header.column.id)) {
         return (
            <SortableHeaderCell
               key={header.id}
               headerId={header.column.id}
               colSpan={header.colSpan}
               pinningStyle={getPinningOffsets(header.column)}
               isPinned={header.column.getIsPinned()}
               align={header.column.columnDef.meta?.align}
               column={header.column}
            >
               {content}
            </SortableHeaderCell>
         );
      }

      return (
         <TableHead
            key={header.id}
            colSpan={header.colSpan}
            className={cn(
               "text-xs font-medium",
               header.column.getIsPinned() && "sticky z-[1] bg-inherit",
               header.column.columnDef.meta?.align === "right" && "text-right",
               header.column.columnDef.meta?.align === "center" &&
                  "text-center",
            )}
            style={getPinningOffsets(header.column)}
         >
            {content}
         </TableHead>
      );
   });

   return (
      <>
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
         <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
         >
            {headers}
         </SortableContext>
      </>
   );
}

// =============================================================================
// Body row
// =============================================================================

function DataTableBodyRow<TData>({
   row,
   getSubRows,
   renderExpandedRow,
}: {
   row: Row<TData>;
   getSubRows?: (row: TData) => TData[] | undefined;
   renderExpandedRow?: (props: { row: Row<TData> }) => React.ReactNode;
}) {
   if (row.depth > 0) {
      return (
         <>
            <TableCell className="w-[40px] p-0" />
            {row.getVisibleCells().map((cell, i) => (
               <TableCell
                  className={cn("truncate text-sm", i === 0 && "pl-6")}
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
         <TableCell className="w-[40px] px-2">
            <div className="flex items-center gap-1">
               {(getSubRows || renderExpandedRow) &&
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
         {row.getVisibleCells().map((cell) => {
            const meta = cell.column.columnDef.meta;
            const isEditable =
               meta?.isEditable &&
               meta.cellComponent &&
               (!meta.isEditableForRow || meta.isEditableForRow(row.original));
            return (
               <TableCell
                  className={cn(
                     "truncate",
                     cell.column.getIsPinned() && "sticky z-[1] bg-inherit",
                     meta?.align === "right" && "text-right",
                     meta?.align === "center" && "text-center",
                  )}
                  key={cell.id}
                  style={{
                     maxWidth: cell.column.columnDef.maxSize,
                     ...getPinningOffsets(cell.column),
                  }}
               >
                  {isEditable ? (
                     <EditableCell
                        cellComponent={meta!.cellComponent!}
                        cellId={cell.id}
                        editMode={meta?.editMode}
                        options={meta?.editOptions}
                        schema={meta?.editSchema}
                        onSave={meta?.onSave}
                        rowId={row.id}
                        value={cell.getValue()}
                     />
                  ) : (
                     flexRender(cell.column.columnDef.cell, cell.getContext())
                  )}
               </TableCell>
            );
         })}
      </>
   );
}

// =============================================================================
// Body rows (with optional grouping)
// =============================================================================

function DataTableBodyRows<TData>({
   table,
   groupBy,
   renderGroupHeader,
   columnCount,
   getSubRows,
   renderExpandedRow,
}: {
   table: TanStackTable<TData>;
   groupBy?: (row: TData) => string;
   renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
   columnCount: number;
   getSubRows?: (row: TData) => TData[] | undefined;
   renderExpandedRow?: (props: { row: Row<TData> }) => React.ReactNode;
}) {
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

   const renderRow = (row: Row<TData>) => (
      <React.Fragment key={row.id}>
         <TableRow
            className={cn("bg-card", row.getIsSelected() && "bg-muted/50")}
            data-state={row.getIsSelected() ? "selected" : undefined}
         >
            <DataTableBodyRow
               row={row}
               getSubRows={getSubRows}
               renderExpandedRow={renderExpandedRow}
            />
         </TableRow>
         {renderExpandedRow && row.getIsExpanded() && (
            <TableRow
               key={`${row.id}-expanded`}
               className="hover:bg-transparent"
            >
               <TableCell colSpan={columnCount} className="p-0 border-b">
                  {renderExpandedRow({ row })}
               </TableCell>
            </TableRow>
         )}
      </React.Fragment>
   );

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
   renderExpandedRow,
   groupBy,
   renderGroupHeader,
   getSubRows,
}: DataTableProps<TData, TValue>) {
   const [internalSorting, setInternalSorting] = useState<SortingState>([]);
   const [internalColumnFilters, setInternalColumnFilters] =
      useState<ColumnFiltersState>([]);
   const [expanded, setExpanded] = useState<ExpandedState>(
      getSubRows ? true : {},
   );
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

   const effectiveColumnPinningRef = useRef(tableState?.columnPinning ?? {});
   useIsomorphicLayoutEffect(() => {
      effectiveColumnPinningRef.current = tableState?.columnPinning ?? {};
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
            columnPinning: effectiveColumnPinningRef.current,
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

   useIsomorphicLayoutEffect(() => {
      columnOrderRef.current = columnOrder;
   });

   const columnOrderMounted = useRef(false);
   useEffect(() => {
      if (!columnOrderMounted.current) {
         columnOrderMounted.current = true;
         return;
      }
      onTableStateChangeRef.current?.({
         columnOrder,
         columnVisibility: effectiveColumnVisibilityRef.current,
         columnPinning: effectiveColumnPinningRef.current,
      });
   }, [columnOrder]);

   const table = useReactTable({
      columns: allColumns,
      data,
      enableRowSelection: true,
      getCoreRowModel: getCoreRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      getFacetedRowModel: getFacetedRowModel(),
      getFacetedUniqueValues: getFacetedUniqueValues(),
      getFacetedMinMaxValues: getFacetedMinMaxValues(),
      getRowId: (originalRow) => getRowId(originalRow),
      getRowCanExpand: renderExpandedRow ? () => true : undefined,
      manualFiltering: true,
      manualSorting: true,
      getSubRows,
      onColumnFiltersChange: effectiveOnColumnFiltersChange,
      onColumnVisibilityChange: handleColumnVisibilityChange,
      onExpandedChange: setExpanded,
      onRowSelectionChange: handleRowSelectionChange,
      onSortingChange: effectiveOnSortingChange,
      onColumnOrderChange: setColumnOrder,
      onColumnPinningChange: (updater) => {
         const next =
            typeof updater === "function"
               ? updater(effectiveColumnPinningRef.current)
               : updater;
         onTableStateChangeRef.current?.({
            columnOrder: columnOrderRef.current,
            columnVisibility: effectiveColumnVisibilityRef.current,
            columnPinning: next,
         });
      },
      state: {
         columnFilters: effectiveColumnFilters,
         columnVisibility: effectiveColumnVisibility,
         expanded,
         rowSelection,
         sorting: effectiveSorting,
         columnOrder,
         columnPinning: {
            ...tableState?.columnPinning,
            right: [...(tableState?.columnPinning?.right ?? []), "__actions"],
         },
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

   const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
         setColumnOrder((prev) => {
            const oldIndex = prev.indexOf(String(active.id));
            const newIndex = prev.indexOf(String(over.id));
            return arrayMove(prev, oldIndex, newIndex);
         });
      }
   }, []);

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
                           <DataTableHeaderRow
                              columnIds={columnIds}
                              effectiveColumnVisibility={
                                 effectiveColumnVisibility
                              }
                              headerGroup={headerGroup}
                              onColumnVisibilityChange={
                                 handleColumnVisibilityChange
                              }
                              table={table}
                           />
                        </TableRow>
                     ))}
                  </TableHeader>
                  <TableBody>
                     <DataTableBodyRows
                        columnCount={columnCount}
                        getSubRows={getSubRows}
                        groupBy={groupBy}
                        renderGroupHeader={renderGroupHeader}
                        table={table}
                     />
                  </TableBody>
               </Table>
            </div>
         </DndContext>
         {pagination && <DataTablePagination {...pagination} />}
      </div>
   );
}
