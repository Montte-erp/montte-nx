import type { Table } from "@tanstack/react-table";
import { SelectionActionButton } from "@packages/ui/components/selection-action-bar";
import { Check, EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { fromPromise } from "neverthrow";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { useSelectionToolbar } from "@/hooks/use-selection-toolbar";
import { DataImportBulkEdit } from "./data-import-bulk-edit";

export const rawImportDataSchema = z.object({
   headers: z.array(z.string()),
   rows: z.array(z.array(z.string())),
});
export type RawImportData = z.infer<typeof rawImportDataSchema>;

export const importableColumnSchema = z.object({
   key: z.string(),
   label: z.string(),
});
export type ImportableColumn = z.infer<typeof importableColumnSchema>;

export interface ImportTemplateFile {
   filename: string;
   label: string;
   createBlob: () => Blob;
}

export interface ImportTemplate {
   label?: string;
   description?: string;
   filename?: string;
   createBlob?: () => Blob;
   formats?: ImportTemplateFile[];
}

export interface DataImportConfig {
   accept?: Record<string, string[]>;
   parseFile: (file: File) => Promise<RawImportData>;
   importColumns?: ImportableColumn[];
   mapRow?: (
      row: Record<string, string>,
      index: number,
   ) => Record<string, unknown>;
   onImport: (rows: Record<string, unknown>[]) => Promise<void>;
   template?: ImportTemplate;
   extraBulkActions?: (ctx: {
      selectedIndices: Set<number>;
      bulkUpdate: (
         indices: Set<number>,
         keyOrPatch: string | Record<string, unknown>,
         value?: unknown,
      ) => void;
      clear: () => void;
   }) => ReactNode;
}

export interface ImportState {
   rawHeaders: string[];
   rawRows: string[][];
   mapping: Record<string, string>;
   importRows: Record<string, unknown>[];
}

function normalizeHeader(s: string) {
   return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
}

function autoMatch(
   fileHeaders: string[],
   cols: ImportableColumn[],
): Record<string, string> {
   const mapping: Record<string, string> = {};
   for (const col of cols) {
      const normLabel = normalizeHeader(col.label);
      const normKey = normalizeHeader(col.key);
      const match = fileHeaders.find((h) => {
         const normH = normalizeHeader(h);
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

function getImportableColumns<TData>(
   table: Table<TData>,
   extra: ImportableColumn[] = [],
): ImportableColumn[] {
   return [
      ...table
         .getAllColumns()
         .filter(
            (col) =>
               col.id !== "__select" &&
               col.id !== "__actions" &&
               !col.columnDef.meta?.importIgnore,
         )
         .map((col) => {
            const def = col.columnDef;
            const accessorKey =
               "accessorKey" in def && def.accessorKey != null
                  ? String(def.accessorKey)
                  : col.id;
            return {
               key: accessorKey,
               label: col.columnDef.meta?.label ?? col.id,
            };
         }),
      ...extra,
   ];
}

export interface UseDataImportApi {
   state: ImportState | null;
   selectedIndices: Set<number>;
   ignoredIndices: Set<number>;
   start: (data: RawImportData) => void;
   discard: () => void;
   updateMapping: (mapping: Record<string, string>) => void;
   removeRows: (indices: Set<number>) => void;
   updateRow: (index: number, patch: Record<string, unknown>) => void;
   bulkUpdate: (
      indices: Set<number>,
      keyOrPatch: string | Record<string, unknown>,
      value?: unknown,
   ) => void;
   toggleRow: (index: number) => void;
   toggleAll: () => void;
   clearSelection: () => void;
   ignoreRow: (index: number) => void;
   ignoreSelected: () => void;
   restoreRow: (index: number) => void;
}

function buildImportRows(
   rawRows: string[][],
   rawHeaders: string[],
   mapping: Record<string, string>,
   mapRow?: DataImportConfig["mapRow"],
): Record<string, unknown>[] {
   return rawRows.map((rawRow, i) => {
      const mapped: Record<string, string> = {};
      for (const [colKey, fileHeader] of Object.entries(mapping)) {
         if (!fileHeader) continue;
         const idx = rawHeaders.indexOf(fileHeader);
         mapped[colKey] = idx >= 0 ? (rawRow[idx] ?? "") : "";
      }
      return mapRow ? mapRow(mapped, i) : mapped;
   });
}

export function useDataImport<TData>({
   table,
   config,
}: {
   table: Table<TData>;
   config: DataImportConfig;
}): UseDataImportApi {
   const [state, setState] = useState<ImportState | null>(null);
   const [ignoredIndices, setIgnoredIndices] = useState<Set<number>>(new Set());

   const importableColumns = useMemo(
      () => getImportableColumns(table, config.importColumns ?? []),
      [table, config.importColumns],
   );

   const bulkUpdate = useCallback(
      (
         indices: Set<number>,
         keyOrPatch: string | Record<string, unknown>,
         value?: unknown,
      ) =>
         setState((s) => {
            if (!s) return s;
            const patch =
               typeof keyOrPatch === "string"
                  ? { [keyOrPatch]: value }
                  : keyOrPatch;
            const importRows = [...s.importRows];
            for (const idx of indices) {
               importRows[idx] = { ...importRows[idx], ...patch };
            }
            return { ...s, importRows };
         }),
      [],
   );

   const renderActions = useCallback(
      ({
         selectedIndices,
         clear,
      }: {
         selectedIndices: Set<number>;
         clear: () => void;
      }) => {
         if (!state) return null;
         const indices = [...selectedIndices];
         const hasIgnored = indices.some((i) => ignoredIndices.has(i));
         const hasActive = indices.some((i) => !ignoredIndices.has(i));
         const saveSelected = async () => {
            const active = indices.filter((i) => !ignoredIndices.has(i));
            if (active.length === 0) return;
            const toImport = active
               .map((i) => state.importRows[i])
               .filter((r): r is Record<string, unknown> => r != null);
            const result = await fromPromise(
               config.onImport(toImport),
               (e) => (e as Error)?.message || "Erro ao importar dados.",
            );
            result.match(
               () => {
                  toast.success(
                     `${toImport.length} linha(s) importada(s) com sucesso.`,
                  );
                  setState((s) => {
                     if (!s) return s;
                     const toRemove = new Set(active);
                     const rawRows = s.rawRows.filter(
                        (_, i) => !toRemove.has(i),
                     );
                     const importRows = s.importRows.filter(
                        (_, i) => !toRemove.has(i),
                     );
                     if (rawRows.length === 0) return null;
                     return { ...s, rawRows, importRows };
                  });
                  clear();
               },
               (msg) => toast.error(msg),
            );
         };
         return (
            <>
               <DataImportBulkEdit
                  onUpdate={(key, value) =>
                     bulkUpdate(selectedIndices, key, value)
                  }
                  selectedIndices={selectedIndices}
                  table={table}
               />
               {config.extraBulkActions?.({
                  selectedIndices,
                  bulkUpdate,
                  clear,
               })}
               {hasActive && (
                  <SelectionActionButton
                     icon={<Check className="size-3.5" />}
                     onClick={saveSelected}
                  >
                     Salvar
                  </SelectionActionButton>
               )}
               {hasActive && (
                  <SelectionActionButton
                     icon={<EyeOff className="size-3.5" />}
                     onClick={() => {
                        setIgnoredIndices(
                           (prev) => new Set([...prev, ...selectedIndices]),
                        );
                        clear();
                     }}
                  >
                     Ignorar
                  </SelectionActionButton>
               )}
               {hasIgnored && (
                  <SelectionActionButton
                     icon={<RotateCcw className="size-3.5" />}
                     onClick={() => {
                        setIgnoredIndices((prev) => {
                           const next = new Set(prev);
                           for (const i of selectedIndices) next.delete(i);
                           return next;
                        });
                        clear();
                     }}
                  >
                     Restaurar
                  </SelectionActionButton>
               )}
               <SelectionActionButton
                  icon={<Trash2 className="size-3.5" />}
                  onClick={() => {
                     setState((s) => {
                        if (!s) return s;
                        const rawRows = s.rawRows.filter(
                           (_, i) => !selectedIndices.has(i),
                        );
                        const importRows = s.importRows.filter(
                           (_, i) => !selectedIndices.has(i),
                        );
                        if (rawRows.length === 0) return null;
                        return { ...s, rawRows, importRows };
                     });
                     setIgnoredIndices((prev) => {
                        const next = new Set(prev);
                        for (const i of selectedIndices) next.delete(i);
                        return next;
                     });
                     clear();
                  }}
                  variant="destructive"
               >
                  Remover
               </SelectionActionButton>
            </>
         );
      },
      [state, table, bulkUpdate, ignoredIndices, config],
   );

   const {
      selectedIndices,
      toggle,
      replace,
      clear: clearSelection,
   } = useSelectionToolbar(renderActions);

   const start = useCallback(
      (data: RawImportData) => {
         const mapping = autoMatch(data.headers, importableColumns);
         const importRows = buildImportRows(
            data.rows,
            data.headers,
            mapping,
            config.mapRow,
         );
         setState({
            rawHeaders: data.headers,
            rawRows: data.rows,
            mapping,
            importRows,
         });
         clearSelection();
         setIgnoredIndices(new Set());
      },
      [importableColumns, config, clearSelection],
   );

   const discard = useCallback(() => {
      setState(null);
      clearSelection();
      setIgnoredIndices(new Set());
   }, [clearSelection]);

   const updateMapping = useCallback(
      (mapping: Record<string, string>) =>
         setState((s) =>
            s
               ? {
                    ...s,
                    mapping,
                    importRows: buildImportRows(
                       s.rawRows,
                       s.rawHeaders,
                       mapping,
                       config.mapRow,
                    ),
                 }
               : s,
         ),
      [config.mapRow],
   );

   const removeRows = useCallback(
      (indices: Set<number>) =>
         setState((s) => {
            if (!s) return s;
            const rawRows = s.rawRows.filter((_, i) => !indices.has(i));
            const importRows = s.importRows.filter((_, i) => !indices.has(i));
            if (rawRows.length === 0) return null;
            return { ...s, rawRows, importRows };
         }),
      [],
   );

   const updateRow = useCallback(
      (index: number, patch: Record<string, unknown>) =>
         setState((s) => {
            if (!s) return s;
            const importRows = [...s.importRows];
            importRows[index] = { ...importRows[index], ...patch };
            return { ...s, importRows };
         }),
      [],
   );

   const toggleAll = useCallback(() => {
      const total = state?.rawRows.length ?? 0;
      replace(
         selectedIndices.size === total
            ? new Set()
            : new Set(Array.from({ length: total }, (_, i) => i)),
      );
   }, [state, selectedIndices, replace]);

   const ignoreRow = useCallback(
      (idx: number) => setIgnoredIndices((prev) => new Set([...prev, idx])),
      [],
   );

   const ignoreSelected = useCallback(() => {
      setIgnoredIndices((prev) => new Set([...prev, ...selectedIndices]));
      clearSelection();
   }, [selectedIndices, clearSelection]);

   const restoreRow = useCallback(
      (idx: number) =>
         setIgnoredIndices((prev) => {
            const next = new Set(prev);
            next.delete(idx);
            return next;
         }),
      [],
   );

   return {
      state,
      selectedIndices,
      ignoredIndices,
      start,
      discard,
      updateMapping,
      removeRows,
      updateRow,
      bulkUpdate,
      toggleRow: toggle,
      toggleAll,
      clearSelection,
      ignoreRow,
      ignoreSelected,
      restoreRow,
   };
}
