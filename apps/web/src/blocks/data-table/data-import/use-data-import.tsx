import type { Table } from "@tanstack/react-table";
import { SelectionActionButton } from "@packages/ui/components/selection-action-bar";
import { EyeOff } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSelectionToolbar } from "@/hooks/use-selection-toolbar";
import { DataImportBulkEdit } from "./data-import-bulk-edit";
import { autoMatch, getImportableColumns } from "./match-headers";
import type { DataImportConfig, ImportState, RawImportData } from "./types";

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
