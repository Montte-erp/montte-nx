import { Button } from "@packages/ui/components/button";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Combobox } from "@packages/ui/components/combobox";
import { ChevronRight, Undo2 } from "lucide-react";
import { useCallback } from "react";
import type { ReactNode } from "react";
import { getSampleValues } from "../lib/map-rows";
import { mappingStorageKey } from "../lib/column-mapper";
import type { ImportConfig, RawData } from "../types";

export function MapStep<T>({
   config,
   rawData,
   mapping,
   savedMappingApplied,
   stepBar,
   onMappingChange,
   onProceed,
   onBack,
   onResetMapping,
   isPending,
}: {
   config: ImportConfig<T>;
   rawData: RawData;
   mapping: Record<string, string>;
   savedMappingApplied: boolean;
   stepBar: ReactNode;
   onMappingChange: (m: Record<string, string>) => void;
   onProceed: (m: Record<string, string>) => void;
   onBack: () => void;
   onResetMapping: () => void;
   isPending: boolean;
}) {
   const fieldOptions = [
      { value: "__skip__", label: "Ignorar" },
      ...config.columns.map((c) => ({ value: c.field, label: c.label })),
   ];

   const requiredFields = config.columns
      .filter((c) => c.required)
      .map((c) => c.field);
   const mappedFields = new Set(Object.values(mapping));
   const canProceed = requiredFields.every((f) => mappedFields.has(f));

   const handleProceed = useCallback(() => {
      localStorage.setItem(
         mappingStorageKey(config.featureKey, rawData.headers),
         JSON.stringify(mapping),
      );
      onProceed(mapping);
   }, [config.featureKey, rawData.headers, mapping, onProceed]);

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Mapeie as colunas</CredenzaTitle>
            <CredenzaDescription>
               Diga ao sistema o que cada coluna representa
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               {stepBar}

               {savedMappingApplied && (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                     <p className="text-xs text-muted-foreground">
                        Mapeamento anterior aplicado
                     </p>
                     <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground h-auto py-0 px-1"
                        onClick={onResetMapping}
                     >
                        <Undo2 className="size-3" />
                        Redefinir
                     </Button>
                  </div>
               )}

               <ScrollArea className="max-h-80">
                  <div className="flex flex-col gap-2">
                     {rawData.headers.map((header) => {
                        const sample = getSampleValues(rawData, header);
                        return (
                           <div
                              className="grid grid-cols-[10rem_1fr] items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 overflow-hidden"
                              key={header}
                           >
                              <div className="flex flex-col gap-2 pt-1">
                                 <span className="text-sm font-medium">
                                    {header}
                                 </span>
                                 {sample && (
                                    <span className="text-xs text-muted-foreground truncate">
                                       {sample}
                                    </span>
                                 )}
                              </div>
                              <div
                                 aria-label={`Mapear coluna "${header}"`}
                                 role="group"
                              >
                                 <Combobox
                                    options={fieldOptions}
                                    value={mapping[header] ?? "__skip__"}
                                    onValueChange={(v) =>
                                       onMappingChange({
                                          ...mapping,
                                          [header]: v,
                                       })
                                    }
                                 />
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </ScrollArea>

               <div className="flex gap-2">
                  <Button
                     className="flex-none"
                     onClick={onBack}
                     type="button"
                     variant="outline"
                     disabled={isPending}
                  >
                     Voltar
                  </Button>
                  <Button
                     className="flex-1"
                     disabled={!canProceed || isPending}
                     onClick={handleProceed}
                     type="button"
                  >
                     <span className="flex items-center gap-2">
                        Continuar
                        <ChevronRight className="size-4" />
                     </span>
                  </Button>
               </div>
            </div>
         </CredenzaBody>
      </>
   );
}
