import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Choicebox,
   ChoiceboxItem,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
   ChoiceboxItemDescription,
   ChoiceboxIndicator,
} from "@packages/ui/components/choicebox";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useCredenza } from "@/hooks/use-credenza";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useFileDownload } from "@/hooks/use-file-download";
import type { ImportConfig, RawData } from "../types";

function TemplateCredenza<T>({
   config,
   onClose,
}: {
   config: ImportConfig<T>;
   onClose?: () => void;
}) {
   const csv = useCsvFile();
   const xlsx = useXlsxFile();
   const { download } = useFileDownload();

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Baixar modelo</CredenzaTitle>
            <CredenzaDescription>
               Use como referência para formatar seu arquivo antes de importar
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <Choicebox className="grid grid-cols-2 gap-2">
               <ChoiceboxItem value="csv" id="template-csv">
                  <ChoiceboxIndicator id="template-csv" className="sr-only" />
                  <button
                     type="button"
                     className="flex flex-col gap-2 w-full cursor-pointer"
                     onClick={() => {
                        download(
                           csv.generate(config.template.rows, [
                              ...config.template.headers,
                           ]),
                           `${config.template.filename}.csv`,
                        );
                        onClose?.();
                     }}
                  >
                     <FileSpreadsheet className="size-5 shrink-0 text-emerald-600" />
                     <ChoiceboxItemHeader>
                        <ChoiceboxItemTitle>CSV</ChoiceboxItemTitle>
                        <ChoiceboxItemDescription>
                           Compatível com qualquer planilha ou editor de texto
                        </ChoiceboxItemDescription>
                     </ChoiceboxItemHeader>
                  </button>
               </ChoiceboxItem>
               <ChoiceboxItem value="xlsx" id="template-xlsx">
                  <ChoiceboxIndicator id="template-xlsx" className="sr-only" />
                  <button
                     type="button"
                     className="flex flex-col gap-2 w-full cursor-pointer"
                     onClick={() => {
                        download(
                           xlsx.generate(config.template.rows, [
                              ...config.template.headers,
                           ]),
                           `${config.template.filename}.xlsx`,
                        );
                        onClose?.();
                     }}
                  >
                     <FileSpreadsheet className="size-5 shrink-0 text-green-600" />
                     <ChoiceboxItemHeader>
                        <ChoiceboxItemTitle>XLSX</ChoiceboxItemTitle>
                        <ChoiceboxItemDescription>
                           Excel e Google Sheets — com formatação de colunas
                        </ChoiceboxItemDescription>
                     </ChoiceboxItemHeader>
                  </button>
               </ChoiceboxItem>
            </Choicebox>
         </CredenzaBody>
      </>
   );
}

export function UploadStep<T>({
   config,
   stepBar,
   onParsed,
}: {
   config: ImportConfig<T>;
   stepBar: ReactNode;
   onParsed: (raw: RawData) => void;
}) {
   const csv = useCsvFile();
   const xlsx = useXlsxFile();
   const { openCredenza, closeCredenza } = useCredenza();
   const [isPending, startTransition] = useTransition();
   const [selectedFile, setSelectedFile] = useState<File | undefined>();

   const handleFile = useCallback(
      (file: File) => {
         setSelectedFile(file);
         startTransition(async () => {
            const isXlsx =
               file.name.toLowerCase().endsWith(".xlsx") ||
               file.type ===
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

            const customHandler = config.fileTypeHandlers?.[file.type];
            const parsePromise = customHandler
               ? customHandler(file)
               : isXlsx
                 ? xlsx.parse(file)
                 : csv.parse(file);

            const result = await fromPromise(parsePromise, (e) => e);
            if (result.isErr()) {
               toast.error("Arquivo inválido ou corrompido.");
               setSelectedFile(undefined);
               return;
            }
            onParsed(result.value);
         });
      },
      [config, csv, xlsx, onParsed],
   );

   const accept = {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
         ".xlsx",
      ],
      ...Object.fromEntries(
         Object.keys(config.fileTypeHandlers ?? {}).map((mime) => [mime, []]),
      ),
   };

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Importar</CredenzaTitle>
            <CredenzaDescription>
               Envie um arquivo CSV ou XLSX com seus dados
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               {stepBar}

               <Dropzone
                  accept={accept}
                  disabled={isPending}
                  maxFiles={1}
                  onDrop={([file]) => {
                     if (file) handleFile(file);
                  }}
                  onError={(e) => toast.error(e.message)}
                  src={selectedFile ? [selectedFile] : undefined}
               >
                  <DropzoneEmptyState>
                     {isPending ? (
                        <Loader2 className="size-8 text-primary animate-spin" />
                     ) : (
                        <>
                           <FileSpreadsheet
                              aria-hidden="true"
                              className="size-8 text-muted-foreground"
                           />
                           <p className="font-medium text-sm">
                              Arraste e solte ou clique para selecionar
                           </p>
                           <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                                 <FileSpreadsheet
                                    aria-hidden="true"
                                    className="size-3.5 text-emerald-600"
                                 />
                                 <span className="text-xs font-medium">
                                    CSV
                                 </span>
                              </div>
                              <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                                 <FileSpreadsheet
                                    aria-hidden="true"
                                    className="size-3.5 text-green-600"
                                 />
                                 <span className="text-xs font-medium">
                                    XLSX
                                 </span>
                              </div>
                           </div>
                        </>
                     )}
                  </DropzoneEmptyState>
                  <DropzoneContent />
               </Dropzone>

               <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="self-start px-0 text-muted-foreground"
                  onClick={() =>
                     openCredenza({
                        renderChildren: () => (
                           <TemplateCredenza
                              config={config}
                              onClose={closeCredenza}
                           />
                        ),
                     })
                  }
               >
                  Baixar modelo
               </Button>
            </div>
         </CredenzaBody>
      </>
   );
}
