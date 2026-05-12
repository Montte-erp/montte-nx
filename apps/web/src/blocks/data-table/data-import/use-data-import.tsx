import type { Table } from "@tanstack/react-table";
import { SelectionActionButton } from "@packages/ui/components/selection-action-bar";
import { EyeOff } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
   bulkUpdate: (indices: Set<number>, key: string, value: unknown) => void;
   toggleRow: (index: number) => void;
   toggleAll: () => void;
   clearSelection: () => void;
   ignoreRow: (index: number) => void;
   ignoreSelected: () => void;
   restoreRow: (index: number) => void;
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
      (indices: Set<number>, key: string, value: unknown) =>
         setState((s) => {
            if (!s) return s;
            const importRows = [...s.importRows];
            for (const idx of indices) {
               importRows[idx] = { ...importRows[idx], [key]: value };
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
         return (
            <>
               <DataImportBulkEdit
                  onUpdate={(key, value) =>
                     bulkUpdate(selectedIndices, key, value)
                  }
                  selectedIndices={selectedIndices}
                  table={table}
               />
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
            </>
         );
      },
      [state, table, bulkUpdate],
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
         const importRows = data.rows.map((rawRow, i) => {
            const mapped: Record<string, string> = {};
            for (const [colKey, fileHeader] of Object.entries(mapping)) {
               if (!fileHeader) continue;
               const idx = data.headers.indexOf(fileHeader);
               mapped[colKey] = idx >= 0 ? (rawRow[idx] ?? "") : "";
            }
            return config.mapRow ? config.mapRow(mapped, i) : mapped;
         });
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
         setState((s) => (s ? { ...s, mapping } : s)),
      [],
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
