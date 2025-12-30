import type { TransactionType } from "@packages/ofx";

export type FileType = "csv" | "ofx";

export type ImportStep =
   | "select-account"
   | "upload"
   | "column-mapping"
   | "preview"
   | "importing";

export type ColumnMapping = {
   date: number;
   amount: number;
   description: number;
   type?: number;
};

export type CsvPreviewData = {
   headers: string[];
   sampleRows: string[][];
   detectedFormat: { id: string; name: string } | null;
   suggestedMapping: {
      date: number | null;
      amount: number | null;
      description: number | null;
   };
   totalRows: number;
   delimiter: string;
   amountFormat: "decimal-comma" | "decimal-dot";
};

export type ParsedTransaction = {
   rowIndex: number;
   date: Date;
   amount: number;
   description: string;
   type: TransactionType;
   externalId?: string; // FITID for OFX
};

export type SerializedTransaction = Omit<ParsedTransaction, "date"> & {
   date: string; // ISO string
};

export type DuplicateInfo = {
   rowIndex: number;
   existingTransactionId: string;
   existingTransactionDate: string;
   existingTransactionDescription: string;
};

// Multi-file batch types
export type ImportedFile = {
   fileIndex: number;
   filename: string;
   fileType: FileType;
   content: string; // base64 encoded
   status: "pending" | "parsing" | "parsed" | "error";
   transactionCount?: number;
   error?: string;
};

export type BatchParsedTransaction = ParsedTransaction & {
   fileIndex: number;
   filename: string;
};

export type SerializedBatchTransaction = Omit<
   BatchParsedTransaction,
   "date"
> & {
   date: string; // ISO string
};

export type BatchDuplicateInfo = DuplicateInfo & {
   fileIndex: number;
   duplicateType: "within_batch" | "existing_database";
   matchScore: number; // 0-1 weighted score
   matchedFileIndex?: number; // For within-batch duplicates
   matchedRowIndex?: number;
};

// CSV preview data per file (for batch imports)
export type CsvPreviewDataPerFile = {
   fileIndex: number;
   previewData: CsvPreviewData;
};

/**
 * Detects file type from filename extension
 */
export function detectFileType(filename: string): FileType | null {
   const ext = filename.split(".").pop()?.toLowerCase();
   if (ext === "csv") return "csv";
   if (ext === "ofx") return "ofx";
   return null;
}

/**
 * Gets the wizard steps based on file type
 */
export function getStepsForFileType(fileType: FileType | null): ImportStep[] {
   if (!fileType) {
      return ["select-account", "upload"];
   }
   if (fileType === "csv") {
      return [
         "select-account",
         "upload",
         "column-mapping",
         "preview",
         "importing",
      ];
   }
   // OFX skips column mapping
   return ["select-account", "upload", "preview", "importing"];
}

/**
 * Gets the wizard steps based on batch file types.
 * If any CSV files exist, includes column-mapping step.
 */
export function getStepsForBatchFileType(files: ImportedFile[]): ImportStep[] {
   if (files.length === 0) {
      return ["select-account", "upload"];
   }

   const hasCsv = files.some((f) => f.fileType === "csv");

   // If any CSV files exist, need column mapping
   if (hasCsv) {
      return [
         "select-account",
         "upload",
         "column-mapping",
         "preview",
         "importing",
      ];
   }

   // Only OFX files - skip column mapping
   return ["select-account", "upload", "preview", "importing"];
}

/**
 * Serializes transactions for session storage
 */
export function serializeTransactions(
   transactions: ParsedTransaction[],
): SerializedTransaction[] {
   return transactions.map((t) => ({
      ...t,
      date: t.date.toISOString(),
   }));
}

/**
 * Deserializes transactions from session storage
 */
export function deserializeTransactions(
   transactions: SerializedTransaction[],
): ParsedTransaction[] {
   return transactions.map((t) => ({
      ...t,
      date: new Date(t.date),
   }));
}

/**
 * Serializes batch transactions for session storage
 */
export function serializeBatchTransactions(
   transactions: BatchParsedTransaction[],
): SerializedBatchTransaction[] {
   return transactions.map((t) => ({
      ...t,
      date: t.date.toISOString(),
   }));
}

/**
 * Deserializes batch transactions from session storage
 */
export function deserializeBatchTransactions(
   transactions: SerializedBatchTransaction[],
): BatchParsedTransaction[] {
   return transactions.map((t) => ({
      ...t,
      date: new Date(t.date),
   }));
}

/**
 * Creates a compound key for batch row selection
 * Format: "fileIndex:rowIndex"
 */
export function createBatchRowKey(fileIndex: number, rowIndex: number): string {
   return `${fileIndex}:${rowIndex}`;
}

/**
 * Parses a compound batch row key
 */
export function parseBatchRowKey(key: string): {
   fileIndex: number;
   rowIndex: number;
} | null {
   const parts = key.split(":");
   if (parts.length !== 2) return null;
   const fileIndex = Number.parseInt(parts[0] ?? "", 10);
   const rowIndex = Number.parseInt(parts[1] ?? "", 10);
   if (Number.isNaN(fileIndex) || Number.isNaN(rowIndex)) return null;
   return { fileIndex, rowIndex };
}
