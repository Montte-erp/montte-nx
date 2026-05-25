import type { Column, Table } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import { TableBody, TableCell, TableRow } from "@packages/ui/components/table";
import { cn } from "@packages/ui/lib/utils";
import { Check, Loader2, TriangleAlert, X } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { InlineEditMoney } from "../inline-edit/inline-edit-money";
import { InlineEditSelect } from "../inline-edit/inline-edit-select";
import { InlineEditText } from "../inline-edit/inline-edit-text";
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

function getColumnAccessorKey<TData>(col: Column<TData, unknown>) {
   return "accessorKey" in col.columnDef && col.columnDef.accessorKey != null
      ? String(col.columnDef.accessorKey)
      : col.id;
}

function isImportableColumn<TData>(col: Column<TData, unknown>) {
   return (
      col.id !== "__select" &&
      col.id !== "__actions" &&
      !col.columnDef.meta?.importIgnore
   );
}

function Inner<TData>({ table, api, config, state }: InnerProps<TData>) {
   const { openAlertDialog } = useAlertDialog();
   const [editingColKey, setEditingColKey] = useState<string | null>(null);
   const [isSubmitting, setSubmitting] = useState(false);
   const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
   const [sentinelElement, setSentinelElement] =
      useState<HTMLTableRowElement | null>(null);
   const [scrollMargin, setScrollMargin] = useState(0);

   const { rawHeaders, rawRows, mapping, importRows } = state;
   const { selectedIndices, ignoredIndices } = api;
   const hasImportRows = importRows.length > 0;
   const visibleCols = table.getVisibleLeafColumns();
   const importableColumns = useMemo(
      () => visibleCols.filter(isImportableColumn),
      [visibleCols],
   );
   const montteColumns = importableColumns;
   const hasSelectColumn = visibleCols.some((col) => col.id === "__select");
   const hasActionsColumn = visibleCols.some((col) => col.id === "__actions");
   const mappedHeaders = useMemo(
      () =>
         new Set(
            Object.values(mapping).filter(
               (value) => value && value !== "__none__",
            ),
         ),
      [mapping],
   );
   const extraHeaders = useMemo(
      () => rawHeaders.filter((header) => !mappedHeaders.has(header)),
      [mappedHeaders, rawHeaders],
   );
   const colCount =
      (hasSelectColumn ? 1 : 0) +
      montteColumns.length +
      (hasActionsColumn ? 1 : 0) +
      extraHeaders.length;
   const activeCount = rawRows.length - ignoredIndices.size;
   const typeCounts = useMemo(() => {
      let income = 0;
      let expense = 0;
      for (const row of importRows) {
         if (row.type === "income") income += 1;
         if (row.type === "expense") expense += 1;
      }
      return { income, expense };
   }, [importRows]);

   const duplicateIndices = useMemo(() => {
      if (!hasImportRows) return new Set<number>();
      const firstCol = montteColumns[0];
      if (!firstCol) return new Set<number>();
      const accKey = getColumnAccessorKey(firstCol);
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
   }, [importRows, hasImportRows, table, montteColumns]);

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
   const virtualizer = useVirtualizer({
      count: rawRows.length,
      estimateSize: () => 54,
      getItemKey: (index) => `__import_${index}`,
      getScrollElement: () => scrollElement,
      overscan: 5,
      scrollMargin,
   });
   const virtualRows = virtualizer.getVirtualItems();
   const topPadding = Math.max(
      0,
      virtualRows[0] ? virtualRows[0].start - scrollMargin : 0,
   );
   const lastVirtualRow = virtualRows[virtualRows.length - 1];
   const bottomPadding = Math.max(
      0,
      lastVirtualRow
         ? virtualizer.getTotalSize() - (lastVirtualRow.end - scrollMargin)
         : 0,
   );
   const handleImportBodyRef = useCallback(
      (node: HTMLTableSectionElement | null) => {
         if (!node) {
            setScrollElement(null);
            return;
         }
         const viewport = node.closest('[data-slot="scroll-area-viewport"]');
         setScrollElement(viewport instanceof HTMLElement ? viewport : null);
      },
      [],
   );

   const updateScrollMargin = useCallback(() => {
      if (!sentinelElement || !scrollElement) return;
      const sentinelRect = sentinelElement.getBoundingClientRect();
      const scrollRect = scrollElement.getBoundingClientRect();
      const next = Math.max(
         0,
         sentinelRect.top - scrollRect.top + scrollElement.scrollTop,
      );
      setScrollMargin((current) =>
         Math.abs(current - next) > 1 ? next : current,
      );
   }, [scrollElement, sentinelElement]);

   useLayoutEffect(() => {
      if (!sentinelElement || !scrollElement) return;
      updateScrollMargin();
      const frame = window.requestAnimationFrame(updateScrollMargin);
      const resizeObserver = new ResizeObserver(updateScrollMargin);
      resizeObserver.observe(sentinelElement);
      if (scrollElement.firstElementChild) {
         resizeObserver.observe(scrollElement.firstElementChild);
      }
      return () => {
         window.cancelAnimationFrame(frame);
         resizeObserver.disconnect();
      };
   }, [scrollElement, sentinelElement, updateScrollMargin]);

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

   const getRawValue = useCallback(
      (row: string[], header: string) => {
         const idx = rawHeaders.indexOf(header);
         return idx >= 0 ? (row[idx] ?? "") : "";
      },
      [rawHeaders],
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
      <TableBody ref={handleImportBodyRef}>
         <TableRow className="sticky top-10 z-40 border-y border-border bg-secondary/90 hover:bg-secondary/90">
            <TableCell
               className="bg-secondary/90 px-4 py-2 text-foreground"
               colSpan={colCount}
            >
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
                     {typeCounts.income > 0 && (
                        <Badge className="border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 text-xs font-normal">
                           A receber → Receita · {typeCounts.income}
                        </Badge>
                     )}
                     {typeCounts.expense > 0 && (
                        <Badge className="border-rose-500/30 bg-rose-500/[0.08] text-rose-300 text-xs font-normal">
                           A pagar → Despesa · {typeCounts.expense}
                        </Badge>
                     )}
                     <span className="text-muted-foreground text-xs">
                        De/para: campo Montte → coluna da planilha
                     </span>
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

         <TableRow className="sticky top-20 z-30 border-b border-border bg-secondary/40 shadow-[0_8px_12px_-12px_rgb(0_0_0/0.45)] hover:bg-secondary/40">
            {hasSelectColumn && (
               <TableCell className="w-10 bg-secondary/40 px-2 align-bottom">
                  <Checkbox
                     aria-label="Selecionar todos"
                     checked={someSelected ? "indeterminate" : allSelected}
                     onCheckedChange={api.toggleAll}
                  />
               </TableCell>
            )}
            {montteColumns.map((col) => {
               const label = col.columnDef.meta?.label ?? col.id;
               const required = col.columnDef.meta?.required;
               const accKey = getColumnAccessorKey(col);
               const currentHeader = mapping[accKey] ?? "";
               const isEditing = editingColKey === accKey;
               return (
                  <TableCell
                     className="bg-secondary/40 py-2 pr-2 align-top"
                     key={`montte-map-${col.id}`}
                  >
                     <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                           <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                              Montte
                           </span>
                           <span className="truncate text-xs font-medium text-foreground">
                              {label}
                              {required && (
                                 <span
                                    aria-label="Campo obrigatório"
                                    className="ml-0.5 text-destructive"
                                 >
                                    *
                                 </span>
                              )}
                           </span>
                        </div>
                        {isEditing ? (
                           <Combobox
                              className="h-8 w-full border-dashed bg-card/70 text-xs"
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
                              className={cn(
                                 "h-8 w-full justify-start gap-2 rounded-md border border-dashed border-border/80 bg-card/70 px-2 text-left text-xs shadow-none hover:bg-card",
                                 !currentHeader &&
                                    required &&
                                    "border-destructive/40 bg-destructive/[0.04]",
                              )}
                              data-testid={
                                 required ? "unmapped-required" : undefined
                              }
                              onClick={() => setEditingColKey(accKey)}
                              type="button"
                              variant="ghost"
                           >
                              <span className="shrink-0 text-muted-foreground">
                                 Planilha:
                              </span>
                              {currentHeader ? (
                                 <span className="truncate font-medium text-foreground">
                                    {currentHeader}
                                 </span>
                              ) : (
                                 <span className="truncate italic text-muted-foreground">
                                    Não mapeado
                                 </span>
                              )}
                           </Button>
                        )}
                     </div>
                  </TableCell>
               );
            })}
            {hasActionsColumn && (
               <TableCell
                  className="bg-secondary/40"
                  key="montte-mapping-actions"
               />
            )}
            {extraHeaders.map((header, index) => (
               <TableCell
                  className="bg-secondary/40 py-2 pr-2 align-top"
                  key={`montte-extra-${header}-${index}`}
               >
                  <div className="flex min-w-0 flex-col gap-2">
                     <span className="text-[11px] font-medium leading-none text-muted-foreground">
                        Planilha
                     </span>
                     <span className="truncate rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground">
                        {header}
                     </span>
                  </div>
               </TableCell>
            ))}
         </TableRow>

         <TableRow
            ref={setSentinelElement}
            aria-hidden="true"
            className="border-0 hover:bg-transparent"
         >
            <TableCell className="border-0 p-0" colSpan={colCount} />
         </TableRow>

         {topPadding > 0 && (
            <TableRow
               aria-hidden="true"
               className="border-0 hover:bg-transparent"
            >
               <TableCell
                  className="border-0 p-0"
                  colSpan={colCount}
                  style={{ height: topPadding }}
               />
            </TableRow>
         )}

         {virtualRows.map((virtualRow) => {
            const rowIdx = virtualRow.index;
            const row = rawRows[rowIdx];
            if (!row) return null;
            const isSelected = selectedIndices.has(rowIdx);
            const isIgnored = ignoredIndices.has(rowIdx);
            const isDuplicate = duplicateIndices.has(rowIdx);
            const importedRow = hasImportRows
               ? (importRows[rowIdx] ?? null)
               : null;
            const rowType = importedRow?.type;
            return (
               <TableRow
                  data-index={virtualRow.index}
                  className={cn(
                     "border-l-2 transition-colors",
                     isIgnored
                        ? "border-l-muted-foreground/20 bg-muted/30 hover:bg-muted/30 opacity-50"
                        : isDuplicate
                          ? "border-l-destructive/50 bg-destructive/[0.03] hover:bg-destructive/[0.07]"
                          : isSelected
                            ? "border-l-primary/40 bg-primary/10 hover:bg-primary/10"
                            : rowType === "income"
                              ? "border-l-primary/70 bg-transparent hover:bg-muted/40"
                              : rowType === "expense"
                                ? "border-l-destructive/70 bg-transparent hover:bg-muted/40"
                                : "border-l-border bg-transparent hover:bg-muted/40",
                  )}
                  key={`__import_${rowIdx}`}
               >
                  {hasSelectColumn && (
                     <TableCell className="w-10 px-2">
                        <Checkbox
                           aria-label="Selecionar linha"
                           checked={isSelected}
                           disabled={isIgnored}
                           onCheckedChange={() => api.toggleRow(rowIdx)}
                        />
                     </TableCell>
                  )}
                  {montteColumns.map((col) => {
                     const accKey = getColumnAccessorKey(col);
                     const fileHeader = mapping[accKey];
                     const rawVal = getRawValue(row, fileHeader ?? "");
                     const val = importedRow ? importedRow[accKey] : rawVal;
                     const meta = col.columnDef.meta;
                     const ariaLabel = meta?.label ?? accKey;
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
                           {importedRow &&
                           meta?.isEditable &&
                           meta.cellComponent === "select" ? (
                              <InlineEditSelect
                                 ariaLabel={ariaLabel}
                                 onSave={(value) => {
                                    api.updateRow(rowIdx, { [accKey]: value });
                                    return Promise.resolve();
                                 }}
                                 options={meta.editOptions ?? []}
                                 value={String(val ?? "")}
                              />
                           ) : importedRow &&
                             meta?.isEditable &&
                             (meta.cellComponent === "text" ||
                                meta.cellComponent === "textarea") ? (
                              <InlineEditText
                                 ariaLabel={ariaLabel}
                                 onSave={(value) => {
                                    api.updateRow(rowIdx, { [accKey]: value });
                                    return Promise.resolve();
                                 }}
                                 placeholder="—"
                                 value={String(val ?? "")}
                              />
                           ) : importedRow &&
                             meta?.isEditable &&
                             meta.cellComponent === "money" ? (
                              <InlineEditMoney
                                 ariaLabel={ariaLabel}
                                 onSave={(value) => {
                                    api.updateRow(rowIdx, { [accKey]: value });
                                    return Promise.resolve();
                                 }}
                                 value={Number(val) || 0}
                                 valueInCents={false}
                              />
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
                  {hasActionsColumn && (
                     <TableCell>
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
                  )}
                  {extraHeaders.map((header, index) => {
                     const rawVal = getRawValue(row, header);
                     return (
                        <TableCell
                           className={cn(
                              "truncate",
                              isIgnored && "line-through",
                           )}
                           key={`__import_${rowIdx}_extra_${header}_${index}`}
                        >
                           {rawVal || (
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

         {bottomPadding > 0 && (
            <TableRow
               aria-hidden="true"
               className="border-0 hover:bg-transparent"
            >
               <TableCell
                  className="border-0 p-0"
                  colSpan={colCount}
                  style={{ height: bottomPadding }}
               />
            </TableRow>
         )}
      </TableBody>
   );
}
