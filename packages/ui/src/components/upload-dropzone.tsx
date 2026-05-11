import { cn } from "@packages/ui/lib/utils";
import type { UploadHookControl } from "@better-upload/client";
import { Loader2, Upload } from "lucide-react";
import { useId } from "react";
import { useDropzone } from "react-dropzone";

type UploadDropzoneProps = {
   control: UploadHookControl<true>;
   id?: string;
   accept?: string;
   metadata?: Record<string, unknown>;
   description?:
      | {
           fileTypes?: string;
           maxFileSize?: string;
           maxFiles?: number;
        }
      | string;
   uploadOverride?: (
      ...args: Parameters<UploadHookControl<true>["upload"]>
   ) => void;

   // Add any additional props you need.
};

export function UploadDropzone({
   control: { upload, isPending },
   id: externalId,
   accept,
   metadata,
   description,
   uploadOverride,
}: UploadDropzoneProps) {
   const id = useId();

   const { getRootProps, getInputProps, isDragActive, inputRef } = useDropzone({
      onDrop: (files) => {
         if (isPending) return;
         if (files.length > 0) {
            if (uploadOverride) {
               uploadOverride(files, { metadata });
            } else {
               upload(files, { metadata });
            }
         }
         if (inputRef.current) {
            inputRef.current.value = "";
         }
      },
      noClick: true,
   });

   return (
      <div
         className={cn(
            "border-input text-foreground relative rounded-lg border border-dashed transition-colors",
            {
               "border-primary/80": isDragActive,
            },
         )}
      >
         <label
            {...getRootProps()}
            className={cn(
               "dark:bg-input/10 flex w-full min-w-72 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg bg-transparent px-2 py-6 transition-colors",
               {
                  "text-muted-foreground cursor-not-allowed": isPending,
                  "hover:bg-accent dark:hover:bg-accent/40": !isPending,
                  "opacity-0": isDragActive,
               },
            )}
            htmlFor={externalId || id}
         >
            <div className="p-2">
               {isPending ? (
                  <Loader2 className="size-6 animate-spin" />
               ) : (
                  <Upload className="size-6" />
               )}
            </div>

            <div className="flex flex-col gap-2 text-center">
               <p className="text-sm font-semibold">
                  Arraste e solte os arquivos aqui
               </p>

               <p className="text-muted-foreground max-w-64 text-xs">
                  {typeof description === "string" ? (
                     description
                  ) : (
                     <>
                        {description?.maxFiles &&
                           `Até ${description.maxFiles} arquivo${description.maxFiles !== 1 ? "s" : ""}.`}{" "}
                        {description?.maxFileSize &&
                           `${description.maxFiles !== 1 ? "Cada um c" : "C"}om até ${description.maxFileSize}.`}{" "}
                        {description?.fileTypes &&
                           `Aceita ${description.fileTypes}.`}
                     </>
                  )}
               </p>
            </div>

            <input
               {...getInputProps()}
               type="file"
               multiple
               id={externalId || id}
               accept={accept}
               disabled={isPending}
            />
         </label>

         {isDragActive && (
            <div className="pointer-events-none absolute inset-0 rounded-lg">
               <div className="dark:bg-accent/40 bg-accent flex size-full flex-col items-center justify-center gap-2 rounded-lg">
                  <div className="p-2">
                     <Upload className="size-6" />
                  </div>

                  <p className="text-sm font-semibold">
                     Solte os arquivos aqui
                  </p>
               </div>
            </div>
         )}
      </div>
   );
}
