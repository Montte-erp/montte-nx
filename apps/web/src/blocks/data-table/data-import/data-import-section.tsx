import type { Table } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import { TableBody, TableCell, TableRow } from "@packages/ui/components/table";
import { cn } from "@packages/ui/lib/utils";
import { Check, Loader2, TriangleAlert, X } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { DataImportConfig } from "./use-data-import";
import type { UseDataImportApi } from "./use-data-import";

interface DataImportSectionProps<TData> {
   table: Table<TData>;
   api: UseDataImportApi;
   config: DataImportConfig;
}

export function DataImportSection<TData>({
   table,
   api,
   config,
}: DataImportSectionProps<TData>) {
   const { state } = api;
   if (!state) return null;
   return <Inner api={api} config={config} state={state} table={table} />;
}

interface InnerProps<TData> extends DataImportSectionProps<TData> {
   state: NonNullable<UseDataImportApi["state"]>;
}

function Inner<TData>({ table, api, config, state }: InnerProps<TData>) {
   const { openAlertDialog } = useAlertDialog();
   const [editingColKey, setEditingColKey] = useState<string | null>(null);
   const [isSubmitting, setSubmitting] = useState(false);

   const { rawHeaders, rawRows, mapping, importRows } = state;
   const { selectedIndices, ignoredIndices } = api;
   const hasImportRows = importRows.length > 0;
   const visibleCols = table.getVisibleLeafColumns();
   const colCount = visibleCols.length;
   const activeCount = rawRows.length - ignoredIndices.size;

   const duplicateIndices = useMemo(() => {
      if (!hasImportRows) return new Set<number>();
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
      const existing = new Set(
         table
            .getCoreRowModel()
            .rows.map((r) => String(r.getValue(accKey) ?? "").toLowerCase()),
      );
      const result = new Set<number>();
      importRows.forEach((r, i) => {
         const val = String(
            (r as Record<string, unknown>)[accKey] ?? "",
         ).toLowerCase();
         if (val && existing.has(val)) result.add(i);
      });
      return result;
   }, [importRows, hasImportRows, table, visibleCols]);

   const headerOptions = useMemo(
      () => [
         { value: "__none__", label: "— Não mapear —" },
         ...rawHeaders.map((h) => ({ value: h, label: h })),
      ],
      [rawHeaders],
   );

   const allSelected =
      rawRows.length > 0 && selectedIndices.size === rawRows.length;
   const someSelected = selectedIndices.size > 0 && !allSelected;

   const buildRowToImport = useCallback(
      (rowIdx: number, currentMapping: Record<string, string>) => {
         if (hasImportRows) return importRows[rowIdx];
         const row = rawRows[rowIdx];
         const entry: Record<string, string> = {};
         for (const [colKey, fileHeader] of Object.entries(currentMapping)) {
            if (!fileHeader || fileHeader === "__none__") continue;
            const idx = rawHeaders.indexOf(fileHeader);
            entry[colKey] = idx >= 0 ? (row[idx] ?? "") : "";
         }
         return entry;
      },
      [hasImportRows, importRows, rawHeaders, rawRows],
   );

   const saveRow = useCallback(
      async (rowIdx: number) => {
         const rowData = buildRowToImport(rowIdx, mapping);
         const result = await fromPromise(
            config.onImport([rowData]),
            () => "Erro ao importar linha.",
         );
         result.match(
            () => {
               toast.success("Linha importada com sucesso.");
               api.removeRows(new Set([rowIdx]));
            },
            (msg) => toast.error(msg),
         );
      },
      [api, buildRowToImport, config, mapping],
   );

   const handleSaveRow = useCallback(
      (rowIdx: number) => {
         if (duplicateIndices.has(rowIdx)) {
            openAlertDialog({
               title: "Salvar linha duplicada?",
               description:
                  "Esta linha pode já existir nos dados atuais. Deseja importar mesmo assim?",
               actionLabel: "Continuar",
               cancelLabel: "Cancelar",
               onAction: async () => saveRow(rowIdx),
            });
            return;
         }
         saveRow(rowIdx);
      },
      [duplicateIndices, openAlertDialog, saveRow],
   );

   const submit = useCallback(async () => {
      setSubmitting(true);
      const activeRows = rawRows
         .map((_, i) => i)
         .filter((i) => !ignoredIndices.has(i));
      const toImport = activeRows.map((i) => buildRowToImport(i, mapping));
      const result = await fromPromise(
         config.onImport(toImport),
         (e) => (e as Error)?.message || "Erro ao importar dados.",
      );
      setSubmitting(false);
      result.match(
         () => {
            toast.success(
               `${toImport.length} linha(s) importada(s) com sucesso.`,
            );
            api.discard();
         },
         (msg) => toast.error(msg),
      );
   }, [api, buildRowToImport, config, ignoredIndices, mapping, rawRows]);

   const handleBulkSave = useCallback(() => {
      const activeDuplicates = [...duplicateIndices].filter(
         (i) => !ignoredIndices.has(i),
      );
      if (activeDuplicates.length > 0) {
         openAlertDialog({
            title: "Salvar duplicados?",
            description: `${activeDuplicates.length} linha(s) podem já existir nos dados atuais. Deseja importar mesmo assim?`,
            actionLabel: "Continuar",
            cancelLabel: "Cancelar",
            onAction: submit,
         });
         return;
      }
      submit();
   }, [duplicateIndices, ignoredIndices, openAlertDialog, submit]);

   return (
      <TableBody>
         <TableRow className="sticky top-10 z-30 bg-muted hover:bg-transparent">
            <TableCell className="bg-muted px-4 py-2" colSpan={colCount}>
               <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-medium">Importando</span>
                     <Badge className="text-xs font-normal" variant="secondary">
                        {activeCount}
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
                     <Button
                        className="size-7"
                        disabled={isSubmitting}
                        onClick={() =>
                           openAlertDialog({
                              title: "Salvar importação?",
                              description: `${activeCount} linha(s) serão importadas.`,
                              actionLabel: "Salvar",
                              cancelLabel: "Cancelar",
                              onAction: async () => handleBulkSave(),
                           })
                        }
                        size="icon"
                        tooltip={`Salvar ${activeCount} linha(s)`}
                        type="button"
                     >
                        {isSubmitting ? (
                           <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                           <Check className="size-3.5" />
                        )}
                        <span className="sr-only">Salvar importação</span>
                     </Button>
                     <Button
                        className="size-7"
                        onClick={() =>
                           openAlertDialog({
                              title: "Descartar importação?",
                              description:
                                 "Todas as linhas pendentes serão descartadas. Esta ação não pode ser desfeita.",
                              actionLabel: "Descartar",
                              cancelLabel: "Cancelar",
                              variant: "destructive",
                              onAction: async () => api.discard(),
                           })
                        }
                        size="icon"
                        tooltip="Descartar importação"
                        type="button"
                        variant="destructive"
                     >
                        <X className="size-3.5" />
                        <span className="sr-only">Descartar importação</span>
                     </Button>
                  </div>
               </div>
            </TableCell>
         </TableRow>

         <TableRow className="sticky top-20 z-20 bg-muted/20 hover:bg-muted/20">
            {visibleCols.map((col) => {
               if (col.id === "__select") {
                  return (
                     <TableCell className="w-10 px-2" key={col.id}>
                        <Checkbox
                           aria-label="Selecionar todos"
                           checked={
                              someSelected ? "indeterminate" : allSelected
                           }
                           onCheckedChange={api.toggleAll}
                        />
                     </TableCell>
                  );
               }
               if (col.id === "__actions") return <TableCell key={col.id} />;
               const accKey =
                  "accessorKey" in col.columnDef &&
                  col.columnDef.accessorKey != null
                     ? String(col.columnDef.accessorKey)
                     : col.id;
               const currentHeader = mapping[accKey] ?? "";
               const isEditing = editingColKey === accKey;
               const required = col.columnDef.meta?.required;
               return (
                  <TableCell className="py-1 pr-2" key={col.id}>
                     {isEditing ? (
                        <Combobox
                           defaultOpen
                           emptyMessage="Nenhuma coluna encontrada."
                           options={headerOptions}
                           placeholder="Não mapeado"
                           searchPlaceholder="Buscar coluna..."
                           value={currentHeader || "__none__"}
                           onValueChange={(v) => {
                              api.updateMapping({
                                 ...mapping,
                                 [accKey]: v === "__none__" ? "" : v,
                              });
                              setEditingColKey(null);
                           }}
                        />
                     ) : (
                        <Button
                           className="flex w-full items-center justify-start gap-2 px-2 py-2 text-left text-xs"
                           data-testid="mapping-header-button"
                           onClick={() => setEditingColKey(accKey)}
                           type="button"
                           variant="ghost"
                        >
                           {currentHeader ? (
                              <span className="flex-1 truncate font-medium text-foreground">
                                 {currentHeader}
                                 {required && (
                                    <span
                                       aria-label="Obrigatório"
                                       className="ml-0.5 text-destructive"
                                    >
                                       *
                                    </span>
                                 )}
                              </span>
                           ) : (
                              <span
                                 className={cn(
                                    "flex-1 truncate italic",
                                    required
                                       ? "text-destructive/70"
                                       : "text-muted-foreground/50",
                                 )}
                                 data-testid={
                                    required ? "unmapped-required" : undefined
                                 }
                              >
                                 {required ? "Não mapeado *" : "Não mapeado"}
                              </span>
                           )}
                        </Button>
                     )}
                  </TableCell>
               );
            })}
         </TableRow>

         {rawRows.map((row, rowIdx) => {
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
                  key={`__import_${rowIdx}`}
               >
                  {visibleCols.map((col) => {
                     if (col.id === "__select") {
                        return (
                           <TableCell className="w-10 px-2" key={col.id}>
                              <Checkbox
                                 aria-label="Selecionar linha"
                                 checked={isSelected}
                                 disabled={isIgnored}
                                 onCheckedChange={() => api.toggleRow(rowIdx)}
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
                                       onClick={() => api.restoreRow(rowIdx)}
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
                                          onClick={() => api.ignoreRow(rowIdx)}
                                          size="sm"
                                          tooltip="Ignorar linha"
                                          type="button"
                                          variant="ghost"
                                       >
                                          Ignorar
                                       </Button>
                                       <Button
                                          className="h-7 px-2 text-xs"
                                          onClick={() => handleSaveRow(rowIdx)}
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
                     const importedRow = hasImportRows
                        ? (importRows[rowIdx] ?? null)
                        : null;
                     const val = importedRow ? importedRow[accKey] : rawVal;
                     // oxlint-ignore no-explicit-any
                     const fakeCtx: any = importedRow
                        ? {
                             table,
                             row: {
                                id: `__import_${rowIdx}`,
                                original: importedRow,
                                getValue: (id: string) => importedRow[id],
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
                           className={cn(
                              "truncate",
                              !hasImportRows && "text-sm text-foreground/80",
                              isIgnored && "line-through",
                           )}
                           key={col.id}
                        >
                           {fakeCtx
                              ? flexRender(col.columnDef.cell, fakeCtx)
                              : String(rawVal) || (
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
      </TableBody>
   );
}
