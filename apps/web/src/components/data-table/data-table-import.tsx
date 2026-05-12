import { fromPromise } from "neverthrow";
import { useCallback, useState, useTransition } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { Button } from "@packages/ui/components/button";
import { toast } from "sonner";
import { useDataTable } from "./data-table-root";
import { useFileDownload } from "@/hooks/use-file-download";

export type RawImportData = {
   headers: string[];
   rows: string[][];
};

type DataTableImportTemplateFile = {
   filename: string;
   label: string;
   createBlob: () => Blob;
};

export interface DataTableImportConfig {
   accept?: Record<string, string[]>;
   parseFile: (file: File) => Promise<RawImportData>;
   importColumns?: Array<{ key: string; label: string }>;
   mapRow?: (
      row: Record<string, string>,
      index: number,
   ) => Record<string, unknown>;
   onImport: (rows: Record<string, unknown>[]) => Promise<void>;
   template?: {
      label?: string;
      description?: string;
      filename?: string;
      createBlob?: () => Blob;
      formats?: DataTableImportTemplateFile[];
   };
}

const DEFAULT_ACCEPT = {
   "text/csv": [".csv"],
   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
      ".xlsx",
   ],
   "application/vnd.ms-excel": [".xls"],
};
const TEMPLATE_FORMAT_LABELS = new Set(["CSV", "XLSX"]);

function normalize(s: string) {
   return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
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

export function DataTableImportButton({
   importConfig,
}: {
   importConfig: DataTableImportConfig;
}) {
   const { table, store } = useDataTable();
   const { download } = useFileDownload();

   const importableColumns = [
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
            const rawKey =
               "accessorKey" in def && def.accessorKey != null
                  ? String(def.accessorKey)
                  : col.id;
            return { key: rawKey, label: col.columnDef.meta?.label ?? col.id };
         }),
      ...(importConfig.importColumns ?? []),
   ];

   const [open, setOpen] = useState(false);
   const [isParsing, startParsing] = useTransition();
   const [selectedFile, setSelectedFile] = useState<File>();
   const templateFormats =
      importConfig.template?.formats ??
      (importConfig.template?.filename && importConfig.template.createBlob
         ? [
              {
                 filename: importConfig.template.filename,
                 label: importConfig.template.label ?? "Baixar modelo",
                 createBlob: importConfig.template.createBlob,
              },
           ]
         : []);

   const handleDownloadTemplate = useCallback(
      (template: DataTableImportTemplateFile) => {
         download(template.createBlob(), template.filename);
      },
      [download],
   );

   function handleDrop([file]: File[]) {
      if (!file) return;
      setSelectedFile(file);
      startParsing(async () => {
         const result = await fromPromise(
            importConfig.parseFile(file),
            () => "Erro ao processar o arquivo.",
         );
         if (result.isErr()) {
            toast.error(result.error);
            setSelectedFile(undefined);
            return;
         }
         const data = result.value;
         const mapping = autoMatch(data.headers, importableColumns);
         const importRows = data.rows.map((rawRow, i) => {
            const mapped: Record<string, string> = {};
            for (const [colKey, fileHeader] of Object.entries(mapping)) {
               if (!fileHeader) continue;
               const headerIdx = data.headers.indexOf(fileHeader);
               mapped[colKey] = headerIdx >= 0 ? (rawRow[headerIdx] ?? "") : "";
            }
            return importConfig.mapRow
               ? importConfig.mapRow(mapped, i)
               : mapped;
         });
         store.setState((s) => ({
            ...s,
            importState: {
               rawHeaders: data.headers,
               rawRows: data.rows,
               mapping,
               importRows,
               onSave: importConfig.onImport,
            },
         }));
         setOpen(false);
         setSelectedFile(undefined);
      });
   }

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <Button
               size="icon-sm"
               tooltip="Importar dados"
               type="button"
               variant="outline"
            >
               <Download />
               <span className="sr-only">Importar dados</span>
            </Button>
         </PopoverTrigger>
         <PopoverContent
            align="end"
            className="w-[380px] p-4 flex flex-col gap-4"
            sideOffset={8}
         >
            <div>
               <p className="text-sm font-medium">Importar dados</p>
               <p className="text-xs text-muted-foreground">
                  Selecione um arquivo para começar
               </p>
            </div>
            {importConfig.template && templateFormats.length > 0 && (
               <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                     Precisa de um modelo?
                  </span>
                  {templateFormats.map((template) => (
                     <Button
                        className="h-auto p-0 text-xs"
                        key={template.filename}
                        onClick={() => handleDownloadTemplate(template)}
                        type="button"
                        variant="link"
                     >
                        {TEMPLATE_FORMAT_LABELS.has(template.label)
                           ? template.label
                           : `Baixar modelo ${template.label}`}
                     </Button>
                  ))}
               </div>
            )}
            <Dropzone
               accept={importConfig.accept ?? DEFAULT_ACCEPT}
               disabled={isParsing}
               maxFiles={1}
               onDrop={handleDrop}
               src={selectedFile ? [selectedFile] : undefined}
            >
               <DropzoneEmptyState>
                  {isParsing ? (
                     <Loader2 className="size-8 text-primary animate-spin" />
                  ) : (
                     <>
                        <FileSpreadsheet className="size-8 text-muted-foreground" />
                        <p className="text-sm font-medium">
                           Arraste ou clique para selecionar
                        </p>
                        <p className="text-xs text-muted-foreground">
                           CSV · XLSX
                        </p>
                     </>
                  )}
               </DropzoneEmptyState>
               <DropzoneContent />
            </Dropzone>
         </PopoverContent>
      </Popover>
   );
}
