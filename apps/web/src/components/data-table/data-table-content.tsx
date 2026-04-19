import type { Row } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { useForm } from "@tanstack/react-form";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { Textarea } from "@packages/ui/components/textarea";
import { cn } from "@packages/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
         className="group/cell cursor-pointer rounded px-2 py-0.5 -mx-2 hover:bg-muted/60 hover:ring-1 hover:ring-border min-h-[1.5rem] flex items-center gap-2 w-full text-sm transition-colors"
         onClick={() => setEditing(true)}
         onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setEditing(true);
         }}
         role="button"
         tabIndex={0}
      >
         <span className="flex-1 truncate">
            {cellComponent === "select"
               ? (options?.find((o) => o.value === displayValue)?.label ??
                 displayValue)
               : displayValue || (
                    <span className="text-muted-foreground/40">—</span>
                 )}
         </span>
         <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity" />
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
         {row.getVisibleCells().map((cell) => {
            const meta = cell.column.columnDef.meta;
            const isEditable =
               meta?.isEditable &&
               meta.cellComponent &&
               (!meta.isEditableForRow || meta.isEditableForRow(row.original));
            return (
               <TableCell
                  className={cn(
                     cell.column.id === "__select" ? "w-10 px-2" : "truncate",
                     meta?.align === "right" && "text-right",
                     meta?.align === "center" && "text-center",
                  )}
                  key={cell.id}
                  style={{ maxWidth: cell.column.columnDef.maxSize }}
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
