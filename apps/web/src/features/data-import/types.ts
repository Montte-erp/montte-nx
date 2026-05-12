export interface RawImportData {
   headers: string[];
   rows: string[][];
}

export interface ImportableColumn {
   key: string;
   label: string;
}

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
