import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Loader2 } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useTransition } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { ImportConfig } from "../types";

export function ConfirmStep<T>({
   config,
   rows,
   stepBar,
   onBack,
}: {
   config: ImportConfig<T>;
   rows: T[];
   stepBar: ReactNode;
   onBack: () => void;
}) {
   const [isPending, startTransition] = useTransition();

   const validRows = rows.filter((r) => config.isValid(r));
   const invalidCount = rows.length - validRows.length;

   const handleImport = useCallback(() => {
      startTransition(async () => {
         const result = await fromPromise(
            config.onBulkCreate(validRows),
            (e) => e,
         );
         if (result.isErr()) {
            const msg =
               result.error instanceof Error
                  ? result.error.message
                  : "Erro ao importar.";
            toast.error(msg);
            return;
         }
         toast.loading("Importando...", { id: "import-batch" });
         config.onSuccess();
      });
   }, [config, validRows]);

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Tudo certo?</CredenzaTitle>
            <CredenzaDescription>
               Confira o resumo e clique em importar quando estiver pronto
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               {stepBar}

               <div className="rounded-xl border overflow-hidden">
                  <div className="divide-y">
                     <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">
                           Total no arquivo
                        </span>
                        <span className="text-sm font-medium">
                           {rows.length}
                        </span>
                     </div>
                     {invalidCount > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5">
                           <span className="text-sm text-muted-foreground">
                              Com erro (ignoradas)
                           </span>
                           <Badge variant="destructive">{invalidCount}</Badge>
                        </div>
                     )}
                     <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                        <span className="text-sm font-medium">
                           Serão importadas
                        </span>
                        <span className="text-sm font-bold text-primary">
                           {validRows.length}
                        </span>
                     </div>
                  </div>
               </div>

               <div className="flex gap-2">
                  <Button
                     className="flex-none"
                     disabled={isPending}
                     onClick={onBack}
                     type="button"
                     variant="outline"
                  >
                     Voltar
                  </Button>
                  <Button
                     className="flex-1"
                     disabled={isPending || validRows.length === 0}
                     onClick={handleImport}
                     type="button"
                  >
                     <span className="flex items-center gap-2">
                        {isPending && (
                           <Loader2 className="size-4 animate-spin" />
                        )}
                        Importar {validRows.length} item(s)
                     </span>
                  </Button>
               </div>
            </div>
         </CredenzaBody>
      </>
   );
}
