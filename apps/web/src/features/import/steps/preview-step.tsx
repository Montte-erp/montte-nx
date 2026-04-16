import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { getDedupStatus } from "../lib/dedup";
import type { ImportConfig } from "../types";

export function PreviewStep<T>({
   config,
   rows,
   dedupScores,
   stepBar,
   onProceed,
   onBack,
}: {
   config: ImportConfig<T>;
   rows: T[];
   dedupScores: number[] | null;
   stepBar: ReactNode;
   onProceed: () => void;
   onBack: () => void;
}) {
   const previewRef = useRef<HTMLDivElement>(null);

   const extraCols = (dedupScores !== null ? 1 : 0) + 1;

   const virtualizer = useVirtualizer({
      count: rows.length,
      getScrollElement: () => previewRef.current,
      estimateSize: () => 56,
      overscan: 8,
   });

   const validCount = useMemo(
      () => rows.filter((r) => config.isValid(r)).length,
      [rows, config],
   );

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Prévia</CredenzaTitle>
            <CredenzaDescription>
               Revise os dados antes de importar
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               {stepBar}

               <div className="h-56 overflow-auto" ref={previewRef}>
                  <div
                     style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        position: "relative",
                     }}
                  >
                     {virtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        if (!row) return null;
                        const score = dedupScores?.[virtualRow.index] ?? null;
                        const dedupStatus =
                           score !== null ? getDedupStatus(score) : null;
                        const isValid = config.isValid(row);

                        return (
                           <div
                              key={virtualRow.key}
                              className="grid items-center gap-2 border-b px-3 py-2"
                              style={{
                                 position: "absolute",
                                 top: 0,
                                 left: 0,
                                 width: "100%",
                                 height: `${virtualRow.size}px`,
                                 transform: `translateY(${virtualRow.start}px)`,
                                 gridTemplateColumns: `1fr ${Array(
                                    config.previewColumns.length -
                                       1 +
                                       extraCols,
                                 )
                                    .fill("5rem")
                                    .join(" ")}`,
                              }}
                           >
                              {config.previewColumns.map((col) => (
                                 <span key={col.header}>
                                    {col.getValue(row)}
                                 </span>
                              ))}

                              {dedupStatus !== null && (
                                 <span>
                                    {dedupStatus === "duplicate" && (
                                       <Badge variant="destructive">
                                          Duplicata
                                       </Badge>
                                    )}
                                    {dedupStatus === "possible" && (
                                       <Badge variant="secondary">
                                          Possível
                                       </Badge>
                                    )}
                                    {dedupStatus === "new" && (
                                       <Badge variant="outline">Novo</Badge>
                                    )}
                                 </span>
                              )}

                              <span>
                                 {isValid ? (
                                    <>
                                       <CheckCircle2
                                          aria-hidden="true"
                                          className="size-4 text-green-600"
                                       />
                                       <span className="sr-only">Válido</span>
                                    </>
                                 ) : (
                                    <>
                                       <AlertCircle
                                          aria-hidden="true"
                                          className="size-4 text-destructive"
                                       />
                                       <span className="sr-only">Inválido</span>
                                    </>
                                 )}
                              </span>
                           </div>
                        );
                     })}
                  </div>
               </div>

               <div className="flex gap-2">
                  <Button
                     className="flex-none"
                     onClick={onBack}
                     type="button"
                     variant="outline"
                  >
                     Voltar
                  </Button>
                  <Button
                     className="flex-1"
                     disabled={validCount === 0}
                     onClick={onProceed}
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
