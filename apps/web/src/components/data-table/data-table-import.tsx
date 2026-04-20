import { useState, useTransition, useRef } from "react";
import type React from "react";
import {
   FileSpreadsheet,
   Loader2,
   AlertTriangle,
   Undo2,
   X,
} from "lucide-react";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Input } from "@packages/ui/components/input";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import { toast } from "sonner";

export type RawImportData = {
   headers: string[];
   rows: string[][];
};

type ImportStep = "upload" | "map" | "preview" | "confirm";

export type ImportRow = {
   [key: string]: string | string[] | undefined;
   __errors?: string[];
};

export interface DataTableImportConfig {
   parseFile: (file: File) => Promise<RawImportData>;
   onImport: (rows: Record<string, string>[]) => Promise<void>;
   accept?: Record<string, string[]>;
   validateRow?: (row: Record<string, string>) => string[] | null;
   renderBulkActions?: (props: {
      selectedRows: ImportRow[];
      selectedIndices: Set<number>;
      rows: ImportRow[];
      onRowsChange: (rows: ImportRow[]) => void;
      onClearSelection: () => void;
   }) => React.ReactNode;
}

const DEFAULT_ACCEPT = {
   "text/csv": [".csv"],
   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
      ".xlsx",
   ],
   "application/vnd.ms-excel": [".xls"],
};

function normalize(s: string) {
   return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function autoMatch(
   fileHeaders: string[],
   cols: Array<{ key: string; label: string }>,
): Record<string, string> {
   const mapping: Record<string, string> = {};
   for (const col of cols) {
      const normLabel = normalize(col.label);
      const normKey = normalize(col.key);
      const match = fileHeaders.find((h) => {
         const normH = normalize(h);
         return (
            normH === normLabel ||
            normH === normKey ||
            normH.includes(normLabel) ||
            normH.includes(normKey)
         );
      });
      if (match) mapping[col.key] = match;
   }
   return mapping;
}

function applyMapping(
   rawData: RawImportData,
   mapping: Record<string, string>,
   cols: Array<{ key: string; label: string }>,
   validateRow?: DataTableImportConfig["validateRow"],
): ImportRow[] {
   return rawData.rows.map((row) => {
      const record: Record<string, string> = {};
      for (const col of cols) {
         const fileHeader = mapping[col.key];
         if (!fileHeader) continue;
         const idx = rawData.headers.indexOf(fileHeader);
         record[col.key] = idx >= 0 ? (row[idx] ?? "") : "";
      }
      const errors = validateRow?.(record) ?? null;
      if (errors?.length) return { ...record, __errors: errors };
      return record;
   });
}

export { DEFAULT_ACCEPT, normalize, autoMatch, applyMapping };
export type { ImportStep };

const STEPS: ImportStep[] = ["upload", "map", "preview", "confirm"];

function ImportStepBar({ current }: { current: ImportStep }) {
   const idx = STEPS.indexOf(current);
   return (
      <div className="flex items-center gap-2">
         {STEPS.map((_, i) => (
            <div
               key={`step-${i + 1}`}
               className={[
                  "h-1 rounded-full flex-1 transition-all",
                  i === idx
                     ? "bg-primary"
                     : i < idx
                       ? "bg-primary/40"
                       : "bg-muted",
               ].join(" ")}
            />
         ))}
      </div>
   );
}

function UploadStep({
   importConfig,
   onParsed,
}: {
   importConfig: DataTableImportConfig;
   onParsed: (data: RawImportData) => void;
}) {
   const [isPending, startTransition] = useTransition();
   const [selectedFile, setSelectedFile] = useState<File>();

   function handleDrop([file]: File[]) {
      if (!file) return;
      setSelectedFile(file);
      startTransition(async () => {
         try {
            const data = await importConfig.parseFile(file);
            onParsed(data);
         } catch {
            toast.error("Erro ao processar o arquivo.");
            setSelectedFile(undefined);
         }
      });
   }

   return (
      <div className="flex flex-col gap-4">
         <div>
            <p className="text-sm font-medium">Importar dados</p>
            <p className="text-xs text-muted-foreground">
               Selecione um arquivo para começar
            </p>
         </div>
         <Dropzone
            accept={importConfig.accept ?? DEFAULT_ACCEPT}
            disabled={isPending}
            maxFiles={1}
            onDrop={handleDrop}
            src={selectedFile ? [selectedFile] : undefined}
         >
            <DropzoneEmptyState>
               {isPending ? (
                  <Loader2 className="size-8 text-primary animate-spin" />
               ) : (
                  <>
                     <FileSpreadsheet className="size-8 text-muted-foreground" />
                     <p className="text-sm font-medium">
                        Arraste ou clique para selecionar
                     </p>
                     <p className="text-xs text-muted-foreground">CSV · XLSX</p>
                  </>
               )}
            </DropzoneEmptyState>
            <DropzoneContent />
         </Dropzone>
      </div>
   );
}

export { ImportStepBar, UploadStep };

function MapStep({
   rawData,
   importableColumns,
   mapping,
   onMappingChange,
   onNext,
   onBack,
}: {
   rawData: RawImportData;
   importableColumns: Array<{ key: string; label: string }>;
   mapping: Record<string, string>;
   onMappingChange: (m: Record<string, string>) => void;
   onNext: () => void;
   onBack: () => void;
}) {
   const headerOptions = [
      { value: "__none__", label: "— Não mapear —" },
      ...rawData.headers.map((h) => ({ value: h, label: h })),
   ];

   return (
      <div className="flex flex-col gap-4">
         <div>
            <p className="text-sm font-medium">Mapeie as colunas</p>
            <p className="text-xs text-muted-foreground">
               {rawData.rows.length} linha(s) · {rawData.headers.length} colunas
               detectadas
            </p>
         </div>

         <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[9rem_1fr] items-center gap-2 px-1 pb-1">
               <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Campo
               </span>
               <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coluna do arquivo
               </span>
            </div>

            {importableColumns.map((col) => {
               const mapped = mapping[col.key];
               const headerIdx = mapped ? rawData.headers.indexOf(mapped) : -1;
               const sample =
                  headerIdx >= 0
                     ? rawData.rows
                          .slice(0, 3)
                          .map((r) => r[headerIdx])
                          .filter(Boolean)
                          .join(", ")
                     : null;

               return (
                  <div
                     key={col.key}
                     className="grid grid-cols-[9rem_1fr] items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2"
                  >
                     <span className="pt-1 text-sm font-medium">
                        {col.label}
                     </span>
                     <div className="flex flex-col gap-2 min-w-0">
                        <Combobox
                           options={headerOptions}
                           value={mapping[col.key] ?? "__none__"}
                           onValueChange={(v) =>
                              onMappingChange({
                                 ...mapping,
                                 [col.key]: v === "__none__" ? "" : v,
                              })
                           }
                        />
                        {sample && (
                           <p className="truncate px-1 text-xs text-muted-foreground">
                              {sample}
                           </p>
                        )}
                     </div>
                  </div>
               );
            })}
         </div>

         <div className="flex gap-2">
            <Button onClick={onBack} type="button" variant="outline">
               Voltar
            </Button>
            <Button className="flex-1" onClick={onNext} type="button">
               Continuar
            </Button>
         </div>
      </div>
   );
}

export { MapStep };

function PreviewStep({
   importableColumns,
   rows,
   onRowsChange,
   ignoredIndices,
   onIgnoredIndicesChange,
   validateRow,
   renderBulkActions,
   onNext,
   onBack,
}: {
   importableColumns: Array<{ key: string; label: string }>;
   rows: ImportRow[];
   onRowsChange: (rows: ImportRow[]) => void;
   ignoredIndices: Set<number>;
   onIgnoredIndicesChange: (s: Set<number>) => void;
   validateRow?: DataTableImportConfig["validateRow"];
   renderBulkActions?: DataTableImportConfig["renderBulkActions"];
   onNext: () => void;
   onBack: () => void;
}) {
   const parentRef = useRef<HTMLDivElement>(null);
   const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
      new Set(),
   );
   const [editingCell, setEditingCell] = useState<{
      rowIdx: number;
      colKey: string;
   } | null>(null);
   const [showErrorsOnly, setShowErrorsOnly] = useState(false);

   const validRows = rows.filter((r) => !r.__errors?.length);
   const errorRows = rows.filter((r) => r.__errors?.length);

   const displayRows = showErrorsOnly
      ? rows
           .map((r, i) => ({ row: r, originalIndex: i }))
           .filter(({ row }) => row.__errors?.length)
      : rows.map((r, i) => ({ row: r, originalIndex: i }));

   const virtualizer = useVirtualizer({
      count: displayRows.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 40,
      overscan: 8,
   });

   const selectableIndices = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => !r.__errors?.length && !ignoredIndices.has(i))
      .map(({ i }) => i);

   const allSelected =
      selectableIndices.length > 0 &&
      selectableIndices.every((i) => selectedIndices.has(i));
   const someSelected = selectableIndices.some((i) => selectedIndices.has(i));
   const isIndeterminate = someSelected && !allSelected;

   function toggleSelectAll() {
      if (allSelected) {
         setSelectedIndices(new Set());
         return;
      }
      setSelectedIndices(new Set(selectableIndices));
   }

   function toggleRow(idx: number) {
      setSelectedIndices((prev) => {
         const next = new Set(prev);
         if (next.has(idx)) next.delete(idx);
         else next.add(idx);
         return next;
      });
   }

   function ignoreRows(indices: Iterable<number>) {
      const arr = [...indices];
      onIgnoredIndicesChange(
         arr.reduce((s, i) => {
            s.add(i);
            return s;
         }, new Set(ignoredIndices)),
      );
      setSelectedIndices((prev) => {
         const next = new Set(prev);
         for (const i of arr) next.delete(i);
         return next;
      });
   }

   function unignoreRow(idx: number) {
      const next = new Set(ignoredIndices);
      next.delete(idx);
      onIgnoredIndicesChange(next);
   }

   function commitEdit(rowIdx: number, colKey: string, value: string) {
      const updated = rows.map((r, i) => {
         if (i !== rowIdx) return r;
         const newRow: ImportRow = { ...r, [colKey]: value };
         if (validateRow) {
            const clean: Record<string, string> = {};
            for (const [k, v] of Object.entries(newRow)) {
               if (k !== "__errors") clean[k] = String(v ?? "");
            }
            const errors = validateRow(clean);
            if (errors?.length) return { ...newRow, __errors: errors };
         }
         return Object.fromEntries(
            Object.entries(newRow).filter(([k]) => k !== "__errors"),
         ) as ImportRow;
      });
      onRowsChange(updated);
      setEditingCell(null);
   }

   const importableCount = selectableIndices.length;

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <div>
               <p className="text-sm font-medium">Revise os dados</p>
               <p className="text-xs text-muted-foreground">
                  {validRows.length} válidos
                  {errorRows.length > 0 && ` · ${errorRows.length} com erro`}
               </p>
            </div>
            {errorRows.length > 0 && (
               <div className="flex items-center gap-2">
                  <Button
                     size="sm"
                     variant={!showErrorsOnly ? "secondary" : "ghost"}
                     className="h-7 text-xs"
                     onClick={() => setShowErrorsOnly(false)}
                     type="button"
                  >
                     Todos
                  </Button>
                  <Button
                     size="sm"
                     variant={showErrorsOnly ? "secondary" : "ghost"}
                     className="h-7 text-xs"
                     onClick={() => setShowErrorsOnly(true)}
                     type="button"
                  >
                     Com erro
                  </Button>
               </div>
            )}
         </div>

         <div className="rounded-lg border overflow-hidden">
            <div
               className="grid items-center gap-2 border-b bg-muted/50 px-3 py-2"
               style={{
                  gridTemplateColumns: `2rem repeat(${importableColumns.length}, minmax(0, 1fr)) 2rem`,
               }}
            >
               <Checkbox
                  checked={isIndeterminate ? "indeterminate" : allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todos"
               />
               {importableColumns.map((col) => (
                  <span
                     key={col.key}
                     className="text-xs font-medium text-muted-foreground truncate"
                  >
                     {col.label}
                  </span>
               ))}
               <span />
            </div>

            <div ref={parentRef} className="h-56 overflow-auto">
               <div
                  style={{
                     height: virtualizer.getTotalSize(),
                     position: "relative",
                  }}
               >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                     const item = displayRows[virtualRow.index];
                     if (!item) return null;
                     const { row, originalIndex } = item;
                     const hasErrors = !!row.__errors?.length;
                     const isIgnored = ignoredIndices.has(originalIndex);
                     const isSelected = selectedIndices.has(originalIndex);

                     const rowEl = (
                        <div
                           key={virtualRow.key}
                           data-index={virtualRow.index}
                           ref={(el) => {
                              if (el) virtualizer.measureElement(el);
                           }}
                           className={[
                              "grid items-center gap-2 border-b px-3 h-10",
                              hasErrors || isIgnored ? "opacity-50" : "",
                              isIgnored ? "line-through bg-muted/30" : "",
                              isSelected ? "bg-primary/5" : "",
                           ]
                              .filter(Boolean)
                              .join(" ")}
                           style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              transform: `translateY(${virtualRow.start}px)`,
                              gridTemplateColumns: `2rem repeat(${importableColumns.length}, minmax(0, 1fr)) 2rem`,
                           }}
                        >
                           <Checkbox
                              checked={isSelected}
                              disabled={hasErrors || isIgnored}
                              onCheckedChange={() => {
                                 if (!hasErrors && !isIgnored)
                                    toggleRow(originalIndex);
                              }}
                              aria-label="Selecionar linha"
                           />

                           {importableColumns.map((col) => {
                              const isEditing =
                                 editingCell?.rowIdx === originalIndex &&
                                 editingCell?.colKey === col.key;
                              const cellValue = String(row[col.key] ?? "");

                              if (isEditing) {
                                 return (
                                    <Input
                                       key={col.key}
                                       autoFocus
                                       className="h-7 text-xs py-0"
                                       defaultValue={cellValue}
                                       onBlur={(e) =>
                                          commitEdit(
                                             originalIndex,
                                             col.key,
                                             e.target.value,
                                          )
                                       }
                                       onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                             commitEdit(
                                                originalIndex,
                                                col.key,
                                                e.currentTarget.value,
                                             );
                                          if (e.key === "Escape")
                                             setEditingCell(null);
                                       }}
                                    />
                                 );
                              }

                              return (
                                 <span
                                    key={col.key}
                                    className={[
                                       "text-xs truncate",
                                       !hasErrors && !isIgnored
                                          ? "cursor-text hover:underline hover:decoration-dotted"
                                          : "",
                                    ].join(" ")}
                                    onClick={() => {
                                       if (!hasErrors && !isIgnored)
                                          setEditingCell({
                                             rowIdx: originalIndex,
                                             colKey: col.key,
                                          });
                                    }}
                                 >
                                    {cellValue || (
                                       <span className="text-muted-foreground/40">
                                          —
                                       </span>
                                    )}
                                 </span>
                              );
                           })}

                           <span className="flex items-center justify-end">
                              {hasErrors ? (
                                 <AlertTriangle className="size-3.5 text-destructive" />
                              ) : isIgnored ? (
                                 <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => unignoreRow(originalIndex)}
                                    type="button"
                                    aria-label="Desfazer ignorar"
                                 >
                                    <Undo2 className="size-3.5" />
                                 </Button>
                              ) : (
                                 <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6 text-muted-foreground hover:text-destructive"
                                    onClick={() => ignoreRows([originalIndex])}
                                    type="button"
                                    aria-label="Ignorar linha"
                                 >
                                    <X className="size-3.5" />
                                 </Button>
                              )}
                           </span>
                        </div>
                     );

                     if (hasErrors && row.__errors?.length) {
                        return (
                           <TooltipProvider key={virtualRow.key}>
                              <Tooltip>
                                 <TooltipTrigger asChild>
                                    {rowEl}
                                 </TooltipTrigger>
                                 <TooltipContent
                                    side="top"
                                    className="max-w-xs"
                                 >
                                    <p className="text-xs font-medium pb-1">
                                       Não pode ser importado:
                                    </p>
                                    <ul className="list-disc list-inside text-xs">
                                       {row.__errors.map((e) => (
                                          <li key={e}>{e}</li>
                                       ))}
                                    </ul>
                                 </TooltipContent>
                              </Tooltip>
                           </TooltipProvider>
                        );
                     }

                     return rowEl;
                  })}
               </div>
            </div>
         </div>

         {selectedIndices.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
               <span className="text-xs font-medium tabular-nums shrink-0">
                  {selectedIndices.size} de {importableCount} selecionadas
               </span>
               <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-2 px-2 text-xs"
                  onClick={() => setSelectedIndices(new Set())}
                  type="button"
               >
                  <X className="size-3.5" />
                  Limpar
               </Button>
               <div className="h-4 w-px bg-border" />
               <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => ignoreRows(selectedIndices)}
                  type="button"
               >
                  Ignorar selecionadas
               </Button>
               {renderBulkActions?.({
                  selectedRows: [...selectedIndices]
                     .map((i) => rows[i])
                     .filter((r): r is ImportRow => Boolean(r)),
                  selectedIndices,
                  rows,
                  onRowsChange,
                  onClearSelection: () => setSelectedIndices(new Set()),
               })}
            </div>
         )}

         <div className="flex gap-2">
            <Button onClick={onBack} type="button" variant="outline">
               Voltar
            </Button>
            <Button
               className="flex-1"
               disabled={importableCount === 0}
               onClick={() => onNext()}
               type="button"
            >
               Continuar
            </Button>
         </div>
      </div>
   );
}

export { PreviewStep };
