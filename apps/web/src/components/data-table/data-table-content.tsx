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
   ChevronDown,
   Loader2,
   Pencil,
   Upload,
   X,
} from "lucide-react";
import { Badge } from "@packages/ui/components/badge";
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
import { fromPromise } from "neverthrow";
import {
   useCallback,
   useEffect,
   useMemo,
   useRef,
   useState,
   useTransition,
} from "react";
import type React from "react";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import { toast } from "sonner";
import { useDataTable, useDataTableStore } from "./data-table-root";

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
   autoCommitOnBlur,
   inputRef,
   onCommit,
   onCancel,
}: {
   cellComponent: "text" | "textarea" | "select" | "tags";
   field: CellFieldApi;
   options?: Array<{ label: string; value: string }>;
   label?: string;
   autoFocus?: boolean;
   autoCommitOnBlur?: boolean;
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
            onBlur={() => {
               field.handleBlur();
               if (autoCommitOnBlur) onCommit?.();
            }}
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
            onBlur={() => {
               field.handleBlur();
               if (autoCommitOnBlur) onCommit?.();
            }}
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
            <SelectTrigger aria-label={label} className="h-7 text-sm">
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
            aria-label={label}
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
   editMode = "popover",
   label,
   options,
   schema,
   onSave,
   rowId,
   children,
}: {
   value: unknown;
   cellComponent: "text" | "textarea" | "select" | "tags";
   editMode?: "inline" | "popover";
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
         if (onSave) {
            const result = await fromPromise(
               onSave(rowId, value.value),
               (e) => e,
            );
            if (result.isErr()) setLocalValue(prev);
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

   const fieldValidators = schema
      ? {
           onChange: ({ value }: { value: string | string[] }) => {
              const result = schema["~standard"].validate(value);
              if (result instanceof Promise) return undefined;
              return result.issues?.map((i) => i.message).join(", ");
           },
        }
      : undefined;

   if (editMode === "inline") {
      if (!open) {
         return (
            <button
               aria-label={ariaLabel}
               className="group/cell cursor-pointer min-h-[1.5rem] flex items-center gap-2 w-full text-sm text-left"
               type="button"
               onClick={() => setOpen(true)}
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
         );
      }

      return (
         <form
            onSubmit={(e) => {
               e.preventDefault();
               e.stopPropagation();
               form.handleSubmit();
            }}
         >
            <form.Field name="value" validators={fieldValidators}>
               {(field) => (
                  <CellInput
                     autoCommitOnBlur
                     autoFocus
                     cellComponent={cellComponent}
                     field={field as unknown as CellFieldApi}
                     inputRef={inputRef}
                     label={ariaLabel}
                     options={options}
                     onCancel={cancel}
                     onCommit={commit}
                  />
               )}
            </form.Field>
         </form>
      );
   }

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
               <form.Field name="value" validators={fieldValidators}>
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
                        editMode={meta?.editMode}
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

function ImportSection() {
   const { table, store } = useDataTable();
   const importState = useDataTableStore((s) => s.importState);
   const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
      new Set(),
   );
   const [editingColKey, setEditingColKey] = useState<string | null>(null);
   const [isSaving, startSaving] = useTransition();

   if (!importState) return null;

   const { rawHeaders, rawRows, mapping, onSave } = importState;
   const visibleCols = table.getVisibleLeafColumns();
   const colCount = visibleCols.length;

   const headerOptions = [
      { value: "__none__", label: "— Não mapear —" },
      ...rawHeaders.map((h) => ({ value: h, label: h })),
   ];

   const allSelected =
      rawRows.length > 0 && selectedIndices.size === rawRows.length;
   const someSelected = selectedIndices.size > 0 && !allSelected;

   function toggleAll() {
      if (allSelected) {
         setSelectedIndices(new Set());
      } else {
         setSelectedIndices(new Set(rawRows.map((_, i) => i)));
      }
   }

   function toggleRow(idx: number) {
      setSelectedIndices((prev) => {
         const next = new Set(prev);
         if (next.has(idx)) next.delete(idx);
         else next.add(idx);
         return next;
      });
   }

   function setColMapping(colKey: string, fileHeader: string) {
      store.setState((s) => {
         if (!s.importState) return s;
         return {
            ...s,
            importState: {
               ...s.importState,
               mapping: {
                  ...s.importState.mapping,
                  [colKey]: fileHeader === "__none__" ? "" : fileHeader,
               },
            },
         };
      });
   }

   function removeRows(indices: Set<number>) {
      store.setState((s) => {
         if (!s.importState) return s;
         const newRows = s.importState.rawRows.filter(
            (_, i) => !indices.has(i),
         );
         return {
            ...s,
            importState:
               newRows.length === 0
                  ? null
                  : { ...s.importState, rawRows: newRows },
         };
      });
      setSelectedIndices(new Set());
   }

   function discard() {
      store.setState((s) => ({ ...s, importState: null }));
   }

   function handleSave() {
      startSaving(async () => {
         const toImport = rawRows.map((row) => {
            const entry: Record<string, string> = {};
            for (const [colKey, fileHeader] of Object.entries(mapping)) {
               if (!fileHeader) continue;
               const idx = rawHeaders.indexOf(fileHeader);
               entry[colKey] = idx >= 0 ? (row[idx] ?? "") : "";
            }
            return entry;
         });
         try {
            await onSave(toImport);
            toast.success(
               `${toImport.length} linha(s) importada(s) com sucesso.`,
            );
            store.setState((s) => ({ ...s, importState: null }));
         } catch {
            toast.error("Erro ao importar dados.");
         }
      });
   }

   return (
      <>
         {/* Group header */}
         <TableRow className="hover:bg-transparent">
            <TableCell className="bg-muted px-4 py-2" colSpan={colCount}>
               <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                     <div className="flex size-5 items-center justify-center rounded bg-primary/20">
                        <Upload className="size-3 text-primary" />
                     </div>
                     <span className="text-sm font-medium">Importando</span>
                     <Badge className="text-xs font-normal" variant="secondary">
                        {rawRows.length}{" "}
                        {rawRows.length === 1 ? "linha" : "linhas"}
                     </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                     {selectedIndices.size > 0 && (
                        <>
                           <span className="text-xs text-muted-foreground tabular-nums">
                              {selectedIndices.size} selecionada(s)
                           </span>
                           <Button
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() => removeRows(selectedIndices)}
                              size="sm"
                              type="button"
                              variant="ghost"
                           >
                              Remover
                           </Button>
                           <div className="h-4 w-px bg-border" />
                        </>
                     )}
                     <Button
                        className="h-7 gap-2 px-3 text-xs"
                        disabled={isSaving}
                        onClick={handleSave}
                        size="sm"
                        type="button"
                        variant="outline"
                     >
                        {isSaving ? (
                           <Loader2 className="size-3 animate-spin" />
                        ) : (
                           <Check className="size-3" />
                        )}
                        Salvar {rawRows.length} linha(s)
                     </Button>
                     <Button
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={discard}
                        size="icon"
                        tooltip="Descartar importação"
                        type="button"
                        variant="ghost"
                     >
                        <X className="size-3.5" />
                        <span className="sr-only">Descartar importação</span>
                     </Button>
                  </div>
               </div>
            </TableCell>
         </TableRow>

         {/* Column mapping row — click cell to pick file header */}
         <TableRow className="bg-muted/20 hover:bg-muted/20">
            {visibleCols.map((col) => {
               if (col.id === "__select") {
                  return (
                     <TableCell key={col.id} className="w-10 px-2">
                        <Checkbox
                           aria-label="Selecionar todos"
                           checked={
                              someSelected ? "indeterminate" : allSelected
                           }
                           onCheckedChange={toggleAll}
                        />
                     </TableCell>
                  );
               }
               if (col.id === "__actions") {
                  return <TableCell key={col.id} />;
               }
               const accKey =
                  "accessorKey" in col.columnDef &&
                  col.columnDef.accessorKey != null
                     ? String(col.columnDef.accessorKey)
                     : col.id;
               const currentHeader = mapping[accKey];
               const isEditing = editingColKey === accKey;

               return (
                  <TableCell key={col.id} className="py-1 pr-2">
                     <Popover
                        open={isEditing}
                        onOpenChange={(open) =>
                           setEditingColKey(open ? accKey : null)
                        }
                     >
                        <PopoverTrigger asChild>
                           <button
                              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-muted"
                              type="button"
                           >
                              {currentHeader ? (
                                 <span className="flex-1 truncate font-medium text-foreground">
                                    {currentHeader}
                                 </span>
                              ) : (
                                 <span className="flex-1 truncate text-muted-foreground/50 italic">
                                    Não mapeado
                                 </span>
                              )}
                              <ChevronDown className="size-3 shrink-0 text-muted-foreground/60" />
                           </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-56 p-2">
                           <Combobox
                              options={headerOptions}
                              value={mapping[accKey] ?? "__none__"}
                              onValueChange={(v) => {
                                 setColMapping(accKey, v);
                                 setEditingColKey(null);
                              }}
                           />
                        </PopoverContent>
                     </Popover>
                  </TableCell>
               );
            })}
         </TableRow>

         {/* Pending import rows */}
         {rawRows.map((row, rowIdx) => {
            const isSelected = selectedIndices.has(rowIdx);
            return (
               <TableRow
                  className={cn(
                     "border-l-2 border-l-primary/40 transition-colors",
                     isSelected
                        ? "bg-primary/10 hover:bg-primary/10"
                        : "bg-primary/[0.03] hover:bg-primary/[0.07]",
                  )}
                  // oxlint-ignore react/no-array-index-key
                  key={`__import_${rowIdx}`}
               >
                  {visibleCols.map((col) => {
                     if (col.id === "__select") {
                        return (
                           <TableCell key={col.id} className="w-10 px-2">
                              <Checkbox
                                 aria-label="Selecionar linha"
                                 checked={isSelected}
                                 onCheckedChange={() => toggleRow(rowIdx)}
                              />
                           </TableCell>
                        );
                     }
                     if (col.id === "__actions") {
                        return (
                           <TableCell key={col.id}>
                              <div className="flex items-center justify-end gap-2">
                                 <Button
                                    className="text-muted-foreground/40 hover:text-destructive"
                                    onClick={() =>
                                       removeRows(new Set([rowIdx]))
                                    }
                                    size="icon"
                                    tooltip="Remover linha"
                                    type="button"
                                    variant="ghost"
                                 >
                                    <X />
                                    <span className="sr-only">
                                       Remover linha
                                    </span>
                                 </Button>
                              </div>
                           </TableCell>
                        );
                     }
                     const accKey =
                        "accessorKey" in col.columnDef &&
                        col.columnDef.accessorKey != null
                           ? String(col.columnDef.accessorKey)
                           : col.id;
                     const fileHeader = mapping[accKey];
                     const headerIdx = fileHeader
                        ? rawHeaders.indexOf(fileHeader)
                        : -1;
                     const val = headerIdx >= 0 ? (row[headerIdx] ?? "") : "";
                     return (
                        <TableCell
                           key={col.id}
                           className="truncate text-sm text-foreground/80"
                        >
                           {val || (
                              <span className="text-muted-foreground/30">
                                 —
                              </span>
                           )}
                        </TableCell>
                     );
                  })}
               </TableRow>
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
   className?: string;
}

export function DataTableContent<TData>({
   maxHeight,
   className,
}: DataTableContentProps) {
   const { table, groupBy, renderGroupHeader, hasEmptyState } =
      useDataTable<TData>();
   const importState = useDataTableStore((s) => s.importState);
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
         className={cn("rounded-md border overflow-hidden", className)}
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
               <ImportSection />
               <DraftRow />
               {importState !== null && rows.length > 0 && (
                  <TableRow className="hover:bg-transparent">
                     <TableCell
                        className="bg-muted px-4 py-2"
                        colSpan={columnCount}
                     >
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-medium">
                              Existentes
                           </span>
                           <Badge
                              className="text-xs font-normal"
                              variant="secondary"
                           >
                              {rows.length}
                           </Badge>
                        </div>
                     </TableCell>
                  </TableRow>
               )}
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
