import { Button } from "@packages/ui/components/button";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useState, useTransition } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
import { useFileDownload } from "@/hooks/use-file-download";
import type { DataImportConfig, ImportTemplateFile } from "./use-data-import";
import type { UseDataImportApi } from "./use-data-import";

const DEFAULT_ACCEPT = {
   "text/csv": [".csv"],
   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
      ".xlsx",
   ],
   "application/vnd.ms-excel": [".xls"],
};
const TEMPLATE_FORMAT_LABELS = new Set(["CSV", "XLSX"]);

interface DataImportButtonProps {
   api: UseDataImportApi;
   config: DataImportConfig;
}

export function DataImportButton({ api, config }: DataImportButtonProps) {
   const { download } = useFileDownload();
   const [open, setOpen] = useState(false);
   const [isParsing, startParsing] = useTransition();
   const [selectedFile, setSelectedFile] = useState<File>();

   const templateFormats =
      config.template?.formats ??
      (config.template?.filename && config.template.createBlob
         ? [
              {
                 filename: config.template.filename,
                 label: config.template.label ?? "Baixar modelo",
                 createBlob: config.template.createBlob,
              },
           ]
         : []);

   const handleDownloadTemplate = useCallback(
      (template: ImportTemplateFile) => {
         download(template.createBlob(), template.filename);
      },
      [download],
   );

   const handleDrop = useCallback(
      ([file]: File[]) => {
         if (!file) return;
         setSelectedFile(file);
         startParsing(async () => {
            const result = await fromPromise(
               config.parseFile(file),
               () => "Erro ao processar o arquivo.",
            );
            if (result.isErr()) {
               toast.error(result.error);
               setSelectedFile(undefined);
               return;
            }
            api.start(result.value);
            setOpen(false);
            setSelectedFile(undefined);
         });
      },
      [config, api],
   );

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
            {config.template && templateFormats.length > 0 && (
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
               accept={config.accept ?? DEFAULT_ACCEPT}
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
