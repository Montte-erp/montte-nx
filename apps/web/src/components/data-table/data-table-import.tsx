import { useState, useTransition } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
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

export type RawImportData = {
   headers: string[];
   rows: string[][];
};

export interface DataTableImportConfig {
   accept?: Record<string, string[]>;
   parseFile: (file: File) => Promise<RawImportData>;
   onImport: (rows: Record<string, string>[]) => Promise<void>;
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

export function DataTableImportButton({
   importConfig,
}: {
   importConfig: DataTableImportConfig;
}) {
   const { table, store } = useDataTable();

   const importableColumns = table
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
      });

   const [open, setOpen] = useState(false);
   const [isParsing, startParsing] = useTransition();
   const [selectedFile, setSelectedFile] = useState<File>();

   function handleDrop([file]: File[]) {
      if (!file) return;
      setSelectedFile(file);
      startParsing(async () => {
         try {
            const data = await importConfig.parseFile(file);
            const mapping = autoMatch(data.headers, importableColumns);
            store.setState((s) => ({
               ...s,
               importState: {
                  rawHeaders: data.headers,
                  rawRows: data.rows,
                  mapping,
                  onSave: importConfig.onImport,
               },
            }));
            setOpen(false);
            setSelectedFile(undefined);
         } catch {
            toast.error("Erro ao processar o arquivo.");
            setSelectedFile(undefined);
         }
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
               <Upload />
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
