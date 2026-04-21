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
   Loader2,
   Pencil,
   TriangleAlert,
   X,
} from "lucide-react";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { DatePicker } from "@packages/ui/components/date-picker";
import { MoneyInput } from "@packages/ui/components/money-input";
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
import { Separator } from "@packages/ui/components/separator";
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
import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useRef,
   useState,
} from "react";
import type React from "react";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDataTable, useDataTableStore } from "./data-table-root";

const DataTableScrollContext = createContext<HTMLDivElement | null>(null);

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
   onCreateOption,
}: {
   cellComponent:
      | "text"
      | "textarea"
      | "select"
      | "tags"
      | "money"
      | "date"
      | "combobox";
   field: CellFieldApi;
   options?: Array<{ label: string; value: string }>;
   label?: string;
   autoFocus?: boolean;
   autoCommitOnBlur?: boolean;
   inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
   onCommit?: () => void;
   onCancel?: () => void;
   onCreateOption?: (name: string) => Promise<string>;
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
               <SelectValue
                  placeholder={
                     label
                        ? `Selecionar ${label.toLowerCase()}...`
                        : "Selecionar..."
                  }
               />
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

   if (cellComponent === "money") {
      return (
         <MoneyInput
            autoFocus={autoFocus}
            valueInCents={false}
            value={stringValue ? Number(stringValue) : undefined}
            onChange={(v) =>
               field.handleChange(v !== undefined ? String(v) : "")
            }
            onBlur={() => {
               field.handleBlur();
               if (autoCommitOnBlur) onCommit?.();
            }}
         />
      );
   }

   if (cellComponent === "date") {
      const parsed = stringValue ? dayjs(stringValue).toDate() : undefined;
      return (
         <DatePicker
            className="h-7 w-full text-sm"
            date={parsed}
            placeholder="Selecionar data..."
            onSelect={(d) => {
               const formatted = d
                  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                  : "";
               field.handleChange(formatted);
               if (d) onCommit?.();
            }}
         />
      );
   }

   if (cellComponent === "combobox") {
      return (
         <Combobox
            emptyMessage="Nenhuma opção encontrada."
            options={options ?? []}
            placeholder="Selecionar..."
            searchPlaceholder="Buscar..."
            value={stringValue}
            onValueChange={(v) => {
               field.handleChange(v);
               onCommit?.();
            }}
            onCreate={
               onCreateOption
                  ? (name) => {
                       onCreateOption(name).then((id) => {
                          field.handleChange(id);
                          onCommit?.();
                       });
                    }
                  : undefined
            }
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
   onCreateOption,
   rowId,
   children,
}: {
   value: unknown;
   cellComponent:
      | "text"
      | "textarea"
      | "select"
      | "tags"
      | "money"
      | "date"
      | "combobox";
   editMode?: "inline" | "popover";
   label?: string;
   options?: Array<{ label: string; value: string }>;
   schema?: StandardSchemaV1<unknown>;
   onSave?: (rowId: string, value: unknown) => Promise<void>;
   onCreateOption?: (name: string) => Promise<string>;
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
         const resolvedLabel =
            (cellComponent === "select" || cellComponent === "combobox") &&
            options
               ? options.find((o) => o.value === displayValue)?.label
               : undefined;
         return (
            <Button
               aria-label={ariaLabel}
               className="group/cell h-auto min-h-[1.5rem] w-full justify-start gap-2 px-0 text-sm font-normal"
               type="button"
               variant="ghost"
               onClick={() => setOpen(true)}
            >
               {resolvedLabel ? (
                  <span className="flex-1 truncate">{resolvedLabel}</span>
               ) : (
                  (children ?? (
                     <span className="flex-1 truncate">
                        {displayValue || (
                           <span className="text-muted-foreground/40">—</span>
                        )}
                     </span>
                  ))
               )}
               <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity" />
            </Button>
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
                     onCreateOption={onCreateOption}
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
            <Button
               aria-label={ariaLabel}
               className={cn(
                  "group/cell h-auto min-h-[1.5rem] w-full justify-start gap-2 px-0 text-sm font-normal",
                  open && "opacity-60",
               )}
               type="button"
               variant="ghost"
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
            </Button>
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
                           onCreateOption={onCreateOption}
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
                        onCreateOption={meta?.onCreateOption}
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
   const importState = useDataTableStore((s) => s.importState);
   if (!importState) return null;
   return <ImportSectionInner />;
}

function ImportSectionInner() {
   const { table, store } = useDataTable();
   const importState = useDataTableStore((s) => s.importState);
   const { openAlertDialog } = useAlertDialog();
   const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
      new Set(),
   );
   const [ignoredIndices, setIgnoredIndices] = useState<Set<number>>(new Set());
   const [editingColKey, setEditingColKey] = useState<string | null>(null);
   const scrollEl = useContext(DataTableScrollContext);

   const existingRows = table.getCoreRowModel().rows;

   const duplicateIndices = useMemo(() => {
      if (!importState?.importRows.length) return new Set<number>();
      const visibleCols = table.getVisibleLeafColumns();
      const firstCol = visibleCols.find(
         (col) =>
            col.id !== "__select" &&
            col.id !== "__actions" &&
            !col.columnDef.meta?.importIgnore,
      );
      if (!firstCol) return new Set<number>();
      const accKey =
         "accessorKey" in firstCol.columnDef &&
         firstCol.columnDef.accessorKey != null
            ? String(firstCol.columnDef.accessorKey)
            : firstCol.id;
      const existingValues = new Set(
         existingRows.map((r) =>
            String(r.getValue(accKey) ?? "").toLowerCase(),
         ),
      );
      const result = new Set<number>();
      importState.importRows.forEach((r, i) => {
         const val = String(
            (r as Record<string, unknown>)[accKey] ?? "",
         ).toLowerCase();
         if (val && existingValues.has(val)) result.add(i);
      });
      return result;
   }, [importState, existingRows, table]);

   const form = useForm({
      defaultValues: {
         mapping: importState?.mapping ?? ({} as Record<string, string>),
      },
      onSubmit: async ({ value }) => {
         if (!importState) return;
         const { rawHeaders, rawRows, onSave, importRows } = importState;
         const hasImportRows = importRows.length > 0;
         const activeRows = rawRows
            .map((row, i) => ({ row, i }))
            .filter(({ i }) => !ignoredIndices.has(i));
         let toImport: Record<string, unknown>[];
         if (hasImportRows) {
            toImport = activeRows.map(({ i }) => importRows[i]);
         } else {
            toImport = activeRows.map(({ row }) => {
               const entry: Record<string, string> = {};
               for (const [colKey, fileHeader] of Object.entries(
                  value.mapping,
               )) {
                  if (!fileHeader || fileHeader === "__none__") continue;
                  const idx = rawHeaders.indexOf(fileHeader);
                  entry[colKey] = idx >= 0 ? (row[idx] ?? "") : "";
               }
               return entry;
            });
         }
         const result = await fromPromise(
            onSave(toImport),
            () => "Erro ao importar dados.",
         );
         result.match(
            () => {
               toast.success(
                  `${toImport.length} linha(s) importada(s) com sucesso.`,
               );
               store.setState((s) => ({ ...s, importState: null }));
            },
            (msg) => toast.error(msg),
         );
      },
   });

   if (!importState) return null;

   const { rawHeaders, rawRows, importRows } = importState;
   const hasImportRows = importRows.length > 0;
   const visibleCols = table.getVisibleLeafColumns();
   const colCount = visibleCols.length;

   const shouldVirtualizeImport = scrollEl !== null && rawRows.length > 500;
   const importVirtualizer = useVirtualizer({
      count: rawRows.length,
      enabled: shouldVirtualizeImport,
      estimateSize: () => 40,
      getScrollElement: () => scrollEl,
      overscan: 10,
   });
   const virtualImportItems = shouldVirtualizeImport
      ? importVirtualizer.getVirtualItems()
      : null;
   const importTotalSize = importVirtualizer.getTotalSize();
   const importPaddingTop =
      virtualImportItems && virtualImportItems.length > 0
         ? virtualImportItems[0].start
         : 0;
   const importPaddingBottom =
      virtualImportItems && virtualImportItems.length > 0
         ? importTotalSize -
           virtualImportItems[virtualImportItems.length - 1].end
         : 0;

   const headerOptions = [
      { value: "__none__", label: "— Não mapear —" },
      ...rawHeaders.map((h) => ({ value: h, label: h })),
   ];

   const allSelected =
      rawRows.length > 0 && selectedIndices.size === rawRows.length;
   const someSelected = selectedIndices.size > 0 && !allSelected;

   function toggleAll() {
      if (allSelected) setSelectedIndices(new Set());
      else setSelectedIndices(new Set(rawRows.map((_, i) => i)));
   }

   function toggleRow(idx: number) {
      setSelectedIndices((prev) => {
         const next = new Set(prev);
         if (next.has(idx)) next.delete(idx);
         else next.add(idx);
         return next;
      });
   }

   function shiftIgnored(indices: Set<number>, total: number): Set<number> {
      const sorted = Array.from(indices).sort((a, b) => a - b);
      const next = new Set<number>();
      for (let i = 0; i < total; i++) {
         if (indices.has(i)) continue;
         const shift = sorted.filter((r) => r < i).length;
         if (ignoredIndices.has(i)) next.add(i - shift);
      }
      return next;
   }

   function removeRows(indices: Set<number>) {
      setIgnoredIndices(shiftIgnored(indices, rawRows.length));
      store.setState((s) => {
         if (!s.importState) return s;
         const newRows = s.importState.rawRows.filter(
            (_, i) => !indices.has(i),
         );
         const newImportRows = s.importState.importRows.filter(
            (_, i) => !indices.has(i),
         );
         return {
            ...s,
            importState:
               newRows.length === 0
                  ? null
                  : {
                       ...s.importState,
                       rawRows: newRows,
                       importRows: newImportRows,
                    },
         };
      });
      setSelectedIndices(new Set());
   }

   function ignoreRow(idx: number) {
      setIgnoredIndices((prev) => new Set([...prev, idx]));
   }

   function restoreRow(idx: number) {
      setIgnoredIndices((prev) => {
         const next = new Set(prev);
         next.delete(idx);
         return next;
      });
   }

   async function saveRow(rowIdx: number, mapping: Record<string, string>) {
      const row = rawRows[rowIdx];
      let rowData: Record<string, unknown>;
      if (hasImportRows) {
         rowData = importRows[rowIdx];
      } else {
         const entry: Record<string, string> = {};
         for (const [colKey, fileHeader] of Object.entries(mapping)) {
            if (!fileHeader || fileHeader === "__none__") continue;
            const idx = rawHeaders.indexOf(fileHeader);
            entry[colKey] = idx >= 0 ? (row[idx] ?? "") : "";
         }
         rowData = entry;
      }
      if (!importState) return;
      const result = await fromPromise(
         importState.onSave([rowData]),
         () => "Erro ao importar linha.",
      );
      result.match(
         () => {
            toast.success("Linha importada com sucesso.");
            removeRows(new Set([rowIdx]));
         },
         (msg) => toast.error(msg),
      );
   }

   function handleSaveRow(rowIdx: number, mapping: Record<string, string>) {
      if (duplicateIndices.has(rowIdx)) {
         openAlertDialog({
            title: "Salvar linha duplicada?",
            description:
               "Esta linha pode já existir nos dados atuais. Deseja importar mesmo assim?",
            actionLabel: "Continuar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               await saveRow(rowIdx, mapping);
            },
         });
      } else {
         saveRow(rowIdx, mapping);
      }
   }

   function handleBulkSave() {
      const activeDuplicates = [...duplicateIndices].filter(
         (i) => !ignoredIndices.has(i),
      );
      if (activeDuplicates.length > 0) {
         openAlertDialog({
            title: "Salvar duplicados?",
            description: `${activeDuplicates.length} linha(s) podem já existir nos dados atuais. Deseja importar mesmo assim?`,
            actionLabel: "Continuar",
            cancelLabel: "Cancelar",
            onAction: async () => {
               await form.handleSubmit();
            },
         });
      } else {
         form.handleSubmit();
      }
   }

   function discard() {
      store.setState((s) => ({ ...s, importState: null }));
   }

   return (
      <>
         <TableRow className="hover:bg-transparent">
            <TableCell className="bg-muted px-4 py-2" colSpan={colCount}>
               <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-medium">Importando</span>
                     <Badge className="text-xs font-normal" variant="secondary">
                        {rawRows.length - ignoredIndices.size}
                     </Badge>
                     {duplicateIndices.size > 0 && (
                        <Badge
                           className="text-xs font-normal"
                           variant="destructive"
                        >
                           {duplicateIndices.size} duplicado(s)
                        </Badge>
                     )}
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
                           <Separator orientation="vertical" className="h-4" />
                        </>
                     )}
                     <form.Subscribe selector={(s) => s.isSubmitting}>
                        {(isSubmitting) => (
                           <Button
                              className="h-7 gap-2 px-3 text-xs"
                              disabled={isSubmitting}
                              onClick={handleBulkSave}
                              size="sm"
                              type="button"
                              variant="outline"
                           >
                              {isSubmitting ? (
                                 <Loader2 className="size-3 animate-spin" />
                              ) : (
                                 <Check className="size-3" />
                              )}
                              Salvar {rawRows.length - ignoredIndices.size}{" "}
                              linha(s)
                           </Button>
                        )}
                     </form.Subscribe>
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

         <TableRow className="bg-muted/20 hover:bg-muted/20">
            <form.Field name="mapping">
               {(field) =>
                  visibleCols.map((col) => {
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
                     const currentHeader = field.state.value[accKey] ?? "";
                     const isEditing = editingColKey === accKey;

                     return (
                        <TableCell key={col.id} className="py-1 pr-2">
                           {isEditing ? (
                              <Combobox
                                 defaultOpen
                                 emptyMessage="Nenhuma coluna encontrada."
                                 options={headerOptions}
                                 placeholder="Não mapeado"
                                 searchPlaceholder="Buscar coluna..."
                                 value={currentHeader || "__none__"}
                                 onValueChange={(v) => {
                                    field.handleChange({
                                       ...field.state.value,
                                       [accKey]: v === "__none__" ? "" : v,
                                    });
                                    setEditingColKey(null);
                                 }}
                              />
                           ) : (
                              <Button
                                 className="flex w-full items-center justify-start gap-2 px-2 py-2 text-left text-xs"
                                 type="button"
                                 variant="ghost"
                                 onClick={() => setEditingColKey(accKey)}
                              >
                                 {currentHeader ? (
                                    <span className="flex-1 truncate font-medium text-foreground">
                                       {currentHeader}
                                    </span>
                                 ) : (
                                    <span className="flex-1 truncate italic text-muted-foreground/50">
                                       Não mapeado
                                    </span>
                                 )}
                              </Button>
                           )}
                        </TableCell>
                     );
                  })
               }
            </form.Field>
         </TableRow>

         <form.Subscribe selector={(s) => s.values.mapping}>
            {(mapping) => (
               <>
                  {importPaddingTop > 0 && (
                     <TableRow key="__import_pad_top">
                        <TableCell
                           colSpan={colCount}
                           style={{ height: importPaddingTop, padding: 0 }}
                        />
                     </TableRow>
                  )}
                  {(virtualImportItems
                     ? virtualImportItems.map((v) => v.index)
                     : rawRows.map((_, i) => i)
                  ).map((rowIdx) => {
                     const row = rawRows[rowIdx];
                     const isSelected = selectedIndices.has(rowIdx);
                     const isIgnored = ignoredIndices.has(rowIdx);
                     const isDuplicate = duplicateIndices.has(rowIdx);
                     return (
                        <TableRow
                           className={cn(
                              "border-l-2 transition-colors",
                              isIgnored
                                 ? "border-l-muted-foreground/20 bg-muted/30 hover:bg-muted/30 opacity-50"
                                 : isDuplicate
                                   ? "border-l-destructive/50 bg-destructive/[0.03] hover:bg-destructive/[0.07]"
                                   : isSelected
                                     ? "border-l-primary/40 bg-primary/10 hover:bg-primary/10"
                                     : "border-l-primary/40 bg-primary/[0.03] hover:bg-primary/[0.07]",
                           )}
                           // oxlint-ignore react/no-array-index-key
                           key={`__import_${rowIdx}`}
                        >
                           {visibleCols.map((col) => {
                              if (col.id === "__select") {
                                 return (
                                    <TableCell
                                       key={col.id}
                                       className="w-10 px-2"
                                    >
                                       <Checkbox
                                          aria-label="Selecionar linha"
                                          checked={isSelected}
                                          disabled={isIgnored}
                                          onCheckedChange={() =>
                                             toggleRow(rowIdx)
                                          }
                                       />
                                    </TableCell>
                                 );
                              }
                              if (col.id === "__actions") {
                                 return (
                                    <TableCell key={col.id}>
                                       <div className="flex items-center justify-end gap-2">
                                          {isIgnored ? (
                                             <Button
                                                className="h-7 px-2 text-xs"
                                                onClick={() =>
                                                   restoreRow(rowIdx)
                                                }
                                                size="sm"
                                                tooltip="Restaurar linha"
                                                type="button"
                                                variant="ghost"
                                             >
                                                Restaurar
                                             </Button>
                                          ) : (
                                             <>
                                                {isDuplicate && (
                                                   <span className="flex items-center shrink-0">
                                                      <TriangleAlert
                                                         aria-hidden="true"
                                                         className="size-4 text-destructive"
                                                      />
                                                      <span className="sr-only">
                                                         Linha duplicada
                                                      </span>
                                                   </span>
                                                )}
                                                <Button
                                                   className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                   onClick={() =>
                                                      ignoreRow(rowIdx)
                                                   }
                                                   size="sm"
                                                   tooltip="Ignorar linha"
                                                   type="button"
                                                   variant="ghost"
                                                >
                                                   Ignorar
                                                </Button>
                                                <Button
                                                   className="h-7 px-2 text-xs"
                                                   onClick={() =>
                                                      handleSaveRow(
                                                         rowIdx,
                                                         mapping,
                                                      )
                                                   }
                                                   size="sm"
                                                   tooltip="Salvar esta linha"
                                                   type="button"
                                                   variant="outline"
                                                >
                                                   <Check className="size-3" />
                                                   Salvar
                                                </Button>
                                             </>
                                          )}
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
                              const rawVal =
                                 headerIdx >= 0 ? (row[headerIdx] ?? "") : "";
                              const importedRow: Record<
                                 string,
                                 unknown
                              > | null = hasImportRows
                                 ? (importRows[rowIdx] ?? null)
                                 : null;
                              const val = importedRow
                                 ? importedRow[accKey]
                                 : rawVal;
                              const meta = col.columnDef.meta;
                              const isImportEditable =
                                 hasImportRows &&
                                 !isIgnored &&
                                 meta?.isEditable &&
                                 meta.cellComponent &&
                                 (!meta.isEditableForRow ||
                                    meta.isEditableForRow(
                                       importedRow as Parameters<
                                          NonNullable<
                                             typeof meta.isEditableForRow
                                          >
                                       >[0],
                                    ));
                              // oxlint-ignore no-explicit-any
                              const fakeCtx: any = importedRow
                                 ? {
                                      table,
                                      row: {
                                         id: `__import_${rowIdx}`,
                                         original: importedRow,
                                         getValue: (id: string) =>
                                            importedRow[id],
                                         renderValue: (id: string) =>
                                            importedRow[id] ?? null,
                                         depth: 0,
                                         getIsSelected: () => isSelected,
                                         index: rowIdx,
                                      },
                                      column: col,
                                      cell: {
                                         id: `__import_${rowIdx}_${col.id}`,
                                         getValue: () => val,
                                         renderValue: () => val ?? null,
                                      },
                                      getValue: () => val,
                                      renderValue: () => val ?? null,
                                   }
                                 : null;
                              return (
                                 <TableCell
                                    key={col.id}
                                    className={cn(
                                       "truncate",
                                       !hasImportRows &&
                                          "text-sm text-foreground/80",
                                       isImportEditable &&
                                          !isIgnored &&
                                          "hover:bg-muted/60 transition-colors",
                                       isIgnored && "line-through",
                                    )}
                                 >
                                    {isImportEditable && fakeCtx ? (
                                       <EditableCell
                                          cellComponent={meta!.cellComponent!}
                                          editMode={meta?.editMode}
                                          label={meta?.label}
                                          options={meta?.editOptions}
                                          rowId={`__import_${rowIdx}`}
                                          schema={meta?.editSchema}
                                          value={val}
                                          onSave={(_rowId, newValue) => {
                                             store.setState((s) => {
                                                if (!s.importState) return s;
                                                const updatedRows = [
                                                   ...s.importState.importRows,
                                                ];
                                                updatedRows[rowIdx] = {
                                                   ...updatedRows[rowIdx],
                                                   [accKey]: newValue,
                                                };
                                                return {
                                                   ...s,
                                                   importState: {
                                                      ...s.importState,
                                                      importRows: updatedRows,
                                                   },
                                                };
                                             });
                                             return Promise.resolve();
                                          }}
                                       >
                                          {flexRender(
                                             col.columnDef.cell,
                                             fakeCtx,
                                          )}
                                       </EditableCell>
                                    ) : fakeCtx ? (
                                       flexRender(col.columnDef.cell, fakeCtx)
                                    ) : (
                                       String(rawVal) || (
                                          <span className="text-muted-foreground/30">
                                             —
                                          </span>
                                       )
                                    )}
                                 </TableCell>
                              );
                           })}
                        </TableRow>
                     );
                  })}
                  {importPaddingBottom > 0 && (
                     <TableRow key="__import_pad_bottom">
                        <TableCell
                           colSpan={colCount}
                           style={{ height: importPaddingBottom, padding: 0 }}
                        />
                     </TableRow>
                  )}
               </>
            )}
         </form.Subscribe>
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
                              options={meta?.editOptions}
                              onCreateOption={meta?.onCreateOption}
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
   const {
      table,
      groupBy,
      renderGroupHeader,
      hasEmptyState,
      isDraftRowActive,
   } = useDataTable<TData>();
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

   if (
      table.getCoreRowModel().rows.length === 0 &&
      hasEmptyState &&
      !isDraftRowActive &&
      !importState
   )
      return null;

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
      <DataTableScrollContext.Provider value={scrollEl}>
         <div
            className={cn("rounded-md border overflow-hidden", className)}
            ref={isVirtualized ? setScrollEl : undefined}
            style={isVirtualized ? { maxHeight, overflowY: "auto" } : undefined}
         >
            <Table
               className="border-separate border-spacing-0"
               wrapperClassName="overflow-visible"
            >
               <TableHeader className="sticky top-0 z-20 [&>tr]:bg-muted/50 [&_th]:bg-muted/50">
                  {table.getHeaderGroups().map((headerGroup) => (
                     <TableRow
                        className="bg-muted/50 hover:bg-muted/50"
                        key={headerGroup.id}
                     >
                        {headerGroup.headers.map((header) => {
                           if (header.column.id === "__actions") {
                              return (
                                 <TableHead className="w-0" key={header.id} />
                              );
                           }
                           if (header.column.id === "__select") {
                              return (
                                 <TableHead
                                    className="w-10 px-2"
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
                                 aria-sort={
                                    header.column.getCanSort()
                                       ? header.column.getIsSorted() === "asc"
                                          ? "ascending"
                                          : header.column.getIsSorted() ===
                                              "desc"
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
                                       {header.column.getIsSorted() ===
                                       "asc" ? (
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
      </DataTableScrollContext.Provider>
   );
}
