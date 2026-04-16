import type { ReactNode } from "react";

export type RawData = { headers: string[]; rows: string[][] };

export type ColumnDef = {
   field: string;
   label: string;
   patterns: RegExp[];
   required?: boolean;
};

export type ImportConfig<T> = {
   featureKey: string;
   columns: ColumnDef[];
   template: {
      headers: readonly string[];
      rows: Record<string, string>[];
      filename: string;
   };
   /** Extra file parsers keyed by MIME type. e.g. OFX for transactions. */
   fileTypeHandlers?: Record<string, (file: File) => Promise<RawData>>;
   mapRows: (fieldRecords: Record<string, string>[]) => T[];
   isValid: (row: T) => boolean;
   previewColumns: { header: string; getValue: (row: T) => ReactNode }[];
   onBulkCreate: (rows: T[]) => Promise<void>;
   onSuccess: () => void;
   onClose: () => void;
   /**
    * Server-side dedup. Returns one score (0–1) per input row.
    * Called once, async, during map→preview transition.
    * Typically wraps a useMutation captured in the feature page.
    */
   dedup?: {
      checkDuplicates: (rows: T[]) => Promise<number[]>;
   };
};

export type ImportStep = "upload" | "map" | "preview" | "confirm";
export const IMPORT_STEPS = [
   "upload",
   "map",
   "preview",
   "confirm",
] as const satisfies ImportStep[];
