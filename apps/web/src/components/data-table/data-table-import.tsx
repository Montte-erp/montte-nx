import type React from "react";

export type RawImportData = {
   headers: string[];
   rows: string[][];
};

type ImportStep = "upload" | "map" | "preview" | "confirm";

type ImportRow = {
   [key: string]: string | string[] | undefined;
   __errors?: string[];
};

export interface DataTableImportConfig {
   parseFile: (file: File) => Promise<RawImportData>;
   onImport: (rows: Record<string, string>[]) => Promise<void>;
   accept?: Record<string, string[]>;
   validateRow?: (row: Record<string, string>) => string[] | null;
   renderBulkActions?: (props: {
      selectedRows: Record<string, string>[];
      selectedIndices: Set<number>;
      rows: Record<string, string>[];
      onRowsChange: (rows: Record<string, string>[]) => void;
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
export type { ImportStep, ImportRow };
