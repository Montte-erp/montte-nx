import { useState, useTransition } from "react";
import type React from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { toast } from "sonner";

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
