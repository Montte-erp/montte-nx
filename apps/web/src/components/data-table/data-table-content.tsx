import type { Row } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { useForm } from "@tanstack/react-form";
import {
   ArrowDown,
   ArrowUp,
   ArrowUpDown,
   Check,
   Pencil,
   X,
} from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { MultiSelect } from "@packages/ui/components/multi-select";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Select,
   SelectContent,
   SelectGroup,
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
import { Input } from "@packages/ui/components/input";
import { Textarea } from "@packages/ui/components/textarea";
import { cn } from "@packages/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useDataTable } from "./data-table-root";

// Structural interface — compatible with TanStack Form FieldApi instances
// whose value type is string | string[].
interface CellFieldApi {
   state: {
      value: string | string[];
      meta: {
         isTouched: boolean;
         errors: unknown[];
      };
   };
   handleChange: (value: string | string[]) => void;
   handleBlur: () => void;
}

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

function toStringArray(v: unknown): string[] {
   if (!Array.isArray(v)) return [];
   return v.filter((x): x is string => typeof x === "string");
}

function FieldError({
   errors,
   isTouched,
}: {
   errors: unknown[];
   isTouched: boolean;
}) {
   if (!isTouched || errors.length === 0) return null;
   const message = errors
      .map((e) => {
         if (typeof e === "string") return e;
         if (e !== null && typeof e === "object" && "message" in e)
            return String((e as { message: unknown }).message);
         return null;
      })
      .find((m): m is string => m !== null);
   if (!message) return null;
   return (
      <span className="text-xs text-destructive" role="alert">
         {message}
      </span>
   );
}

function EditFormActions({ onCancel }: { onCancel: () => void }) {
   return (
      <div className="flex justify-end gap-2">
         <Button onClick={onCancel} size="sm" type="button" variant="outline">
            Cancelar
         </Button>
         <Button size="sm" type="submit">
            Salvar
         </Button>
      </div>
   );
}

function CellInput({
   cellComponent,
   field,
   options,
   label,
   autoFocus,
   inputRef,
   onCommit,
   onCancel,
}: {
   cellComponent: "text" | "textarea" | "select" | "tags";
   field: CellFieldApi;
   options?: Array<{ label: string; value: string }>;
   label?: string;
   autoFocus?: boolean;
   inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
   onCommit?: () => void;
   onCancel?: () => void;
}) {
   const stringValue =
      typeof field.state.value === "string" ? field.state.value : "";
   const arrayValue = Array.isArray(field.state.value)
      ? toStringArray(field.state.value)
      : [];
   const isInvalid =
      field.state.meta.isTouched && field.state.meta.errors.length > 0;

   if (cellComponent === "text") {
      return (
         <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            aria-invalid={isInvalid}
            aria-label={label}
            autoFocus={autoFocus}
            className="h-7 aria-invalid:border-destructive"
            value={stringValue}
            onBlur={() => field.handleBlur()}
            onChange={(e) => field.handleChange(e.target.value)}
            onKeyDown={(e) => {
               if (e.key === "Escape") {
                  e.preventDefault();
                  onCancel?.();
               }
               if (e.key === "Enter") {
                  e.preventDefault();
                  field.handleChange((e.target as HTMLInputElement).value);
                  onCommit?.();
               }
            }}
         />
      );
   }

   if (cellComponent === "textarea") {
      return (
         <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            aria-invalid={isInvalid}
            aria-label={label}
            autoFocus={autoFocus}
            className="min-h-0 resize-none overflow-hidden aria-invalid:border-destructive"
            rows={1}
            value={stringValue}
            onBlur={() => field.handleBlur()}
            onChange={(e) => {
               e.target.style.height = "auto";
               e.target.style.height = `${e.target.scrollHeight}px`;
               field.handleChange(e.target.value);
            }}
            onKeyDown={(e) => {
               if (e.key === "Escape") {
                  e.preventDefault();
                  onCancel?.();
               }
               if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onCommit?.();
               }
            }}
         />
      );
   }

   if (cellComponent === "select") {
      return (
         <Select
            value={stringValue}
            onValueChange={(v) => {
               field.handleChange(v);
               onCommit?.();
            }}
         >
            <SelectTrigger className="h-7 text-sm">
               <SelectValue />
            </SelectTrigger>
            <SelectContent>
               <SelectGroup>
                  {options?.map((opt) => (
                     <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                     </SelectItem>
                  ))}
               </SelectGroup>
            </SelectContent>
         </Select>
      );
   }

   if (cellComponent === "tags") {
      return (
         <MultiSelect
            onChange={(v) => field.handleChange(v)}
            onCreate={(name) => field.handleChange([...arrayValue, name])}
            options={arrayValue.map((kw) => ({ label: kw, value: kw }))}
            placeholder="Adicionar palavra-chave..."
            selected={arrayValue}
         />
      );
   }

   return null;
}

function EditableCell({
   value: initialValue,
   cellComponent,
   label,
   options,
   schema,
   onSave,
   rowId,
   children,
}: {
   value: unknown;
   cellComponent: "text" | "textarea" | "select" | "tags";
   label?: string;
   options?: Array<{ label: string; value: string }>;
   schema?: StandardSchemaV1<unknown>;
   onSave?: (rowId: string, value: unknown) => Promise<void>;
   rowId: string;
   children?: React.ReactNode;
}) {
   const [open, setOpen] = useState(false);
   const [localValue, setLocalValue] = useState<string | string[]>(
      cellComponent === "tags"
         ? toStringArray(initialValue)
         : String(initialValue ?? ""),
   );
   const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

   useEffect(() => {
      if (!open)
         setLocalValue(
            cellComponent === "tags"
               ? toStringArray(initialValue)
               : String(initialValue ?? ""),
         );
   }, [initialValue, open, cellComponent]);

   const defaultFormValue: string | string[] =
      cellComponent === "tags" ? toStringArray(localValue) : String(localValue);

   const form = useForm({
      defaultValues: { value: defaultFormValue },
      onSubmit: async ({ value }) => {
         const prev = localValue;
         setLocalValue(value.value);
         setOpen(false);
         try {
            await onSave?.(rowId, value.value);
         } catch {
            setLocalValue(prev);
         }
      },
   });

   const cancel = useCallback(() => {
      form.reset();
      setOpen(false);
   }, [form]);

   const commit = useCallback(() => form.handleSubmit(), [form]);

   const ariaLabel = label ? `Editar ${label}` : "Editar";
   const displayValue = Array.isArray(localValue)
      ? localValue.join(", ")
      : localValue;

   return (
      <Popover
         open={open}
         onOpenChange={(next) => {
            if (next) setOpen(true);
            else cancel();
         }}
      >
         <PopoverTrigger asChild>
            <button
               aria-expanded={open}
               aria-haspopup="dialog"
               aria-label={ariaLabel}
               className={cn(
                  "group/cell cursor-pointer min-h-[1.5rem] flex items-center gap-2 w-full text-sm text-left",
                  open && "opacity-60",
               )}
               type="button"
            >
               {children ?? (
                  <span className="flex-1 truncate">
                     {cellComponent === "select"
                        ? (options?.find((o) => o.value === displayValue)
                             ?.label ?? displayValue)
                        : displayValue || (
                             <span className="text-muted-foreground/40">—</span>
                          )}
                  </span>
               )}
               <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity" />
            </button>
         </PopoverTrigger>
         <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] min-w-64 p-2"
            side="bottom"
            sideOffset={-36}
            onOpenAutoFocus={(e) => {
               e.preventDefault();
               inputRef.current?.focus();
            }}
         >
            <form
               onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
               }}
            >
               <form.Field
                  name="value"
                  validators={
                     schema
                        ? {
                             onChange: ({ value }) => {
                                const result =
                                   schema["~standard"].validate(value);
                                if (result instanceof Promise) return undefined;
                                return result.issues
                                   ?.map((i) => i.message)
                                   .join(", ");
                             },
                          }
                        : undefined
                  }
               >
                  {(field) => (
                     <div className="flex flex-col gap-2">
                        <CellInput
                           cellComponent={cellComponent}
                           field={field as unknown as CellFieldApi}
                           inputRef={inputRef}
                           label={ariaLabel}
                           options={options}
                           onCancel={cancel}
                           onCommit={commit}
                        />
                        <FieldError
                           errors={field.state.meta.errors}
                           isTouched={field.state.meta.isTouched}
                        />
                        {cellComponent !== "select" && (
                           <EditFormActions onCancel={cancel} />
                        )}
                     </div>
                  )}
               </form.Field>
            </form>
         </PopoverContent>
      </Popover>
   );
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
                     isEditable && "hover:bg-muted/60 transition-colors",
                  )}
                  key={cell.id}
                  style={{ maxWidth: cell.column.columnDef.maxSize }}
               >
                  {isEditable ? (
                     <EditableCell
                        cellComponent={meta!.cellComponent!}
                        label={meta?.label}
                        options={meta?.editOptions}
                        rowId={row.id}
                        schema={meta?.editSchema}
                        value={cell.getValue()}
                        onSave={meta?.onSave}
                     >
                        {flexRender(
                           cell.column.columnDef.cell,
                           cell.getContext(),
                        )}
                     </EditableCell>
                  ) : (
                     flexRender(cell.column.columnDef.cell, cell.getContext())
                  )}
               </TableCell>
            );
         })}
      </>
   );
}

function DraftRow() {
   const { table, isDraftRowActive, onAddRow, onDiscardAddRow } =
      useDataTable();
   const visibleColumns = table.getVisibleLeafColumns();

   const defaultValues = useMemo(() => {
      const values: Record<string, string | string[]> = {};
      for (const col of visibleColumns) {
         const meta = col.columnDef.meta;
         if (!meta?.cellComponent) continue;
         const fieldName = String(
            (col.columnDef as { accessorKey?: string }).accessorKey ?? col.id,
         );
         values[fieldName] = meta.cellComponent === "tags" ? [] : "";
      }
      return values;
   }, [visibleColumns]);

   const form = useForm({
      defaultValues,
      onSubmit: async ({ value }) => {
         await onAddRow?.(value);
      },
   });

   if (!isDraftRowActive) return null;

   const firstEditableIdx = visibleColumns.findIndex(
      (col) =>
         col.id !== "__select" &&
         col.id !== "__actions" &&
         col.columnDef.meta?.cellComponent,
   );

   return (
      <TableRow className="bg-card">
         {visibleColumns.map((column, colIdx) => {
            const meta = column.columnDef.meta;

            if (column.id === "__select") {
               return <TableCell className="w-10 px-2" key={column.id} />;
            }

            if (column.id === "__actions") {
               return (
                  <TableCell key={column.id}>
                     <div className="flex items-center justify-end gap-2">
                        <Button
                           onClick={onDiscardAddRow}
                           tooltip="Descartar"
                           type="button"
                           variant="outline"
                        >
                           <X data-icon />
                        </Button>
                        <form.Subscribe
                           selector={(s) => s.canSubmit && !s.isSubmitting}
                        >
                           {(canSubmit) => (
                              <Button
                                 disabled={!canSubmit}
                                 onClick={() => form.handleSubmit()}
                                 tooltip="Salvar"
                                 type="button"
                                 variant="outline"
                              >
                                 <Check data-icon />
                              </Button>
                           )}
                        </form.Subscribe>
                     </div>
                  </TableCell>
               );
            }

            const cellComp = meta?.cellComponent;
            if (!cellComp) return <TableCell key={column.id} />;

            const fieldName = String(
               (column.columnDef as { accessorKey?: string }).accessorKey ??
                  column.id,
            );

            return (
               <TableCell className="py-2 truncate" key={column.id}>
                  <form.Field
                     name={fieldName}
                     validators={
                        meta?.editSchema
                           ? {
                                onChange: meta.editSchema,
                                onBlur: meta.editSchema,
                             }
                           : undefined
                     }
                  >
                     {(field) => (
                        <div className="flex flex-col gap-1">
                           <CellInput
                              autoFocus={colIdx === firstEditableIdx}
                              cellComponent={cellComp}
                              field={field as unknown as CellFieldApi}
                              label={meta?.label}
                           />
                           <FieldError
                              errors={field.state.meta.errors}
                              isTouched={field.state.meta.isTouched}
                           />
                        </div>
                     )}
                  </form.Field>
               </TableCell>
            );
         })}
      </TableRow>
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
         className={cn(
            "bg-card hover:bg-card",
            row.getIsSelected() && "bg-muted/50",
         )}
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
      enabled: isVirtualized,
      estimateSize: () => 53,
      getScrollElement: () => scrollEl,
      overscan: 5,
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
                              aria-sort={
                                 header.column.getCanSort()
                                    ? header.column.getIsSorted() === "asc"
                                       ? "ascending"
                                       : header.column.getIsSorted() === "desc"
                                         ? "descending"
                                         : "none"
                                    : undefined
                              }
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
               <DraftRow />
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
