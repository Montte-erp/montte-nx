import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

export function BulkMoveAccountForm({
   bankAccounts,
   selectedCount,
   onApply,
   onCancel,
}: {
   bankAccounts: Array<{ id: string; name: string }>;
   selectedCount: number;
   onApply: (
      bankAccountId: string,
      destinationBankAccountId: string,
   ) => Promise<void>;
   onCancel: () => void;
}) {
   const [bankAccountId, setBankAccountId] = useState<string | undefined>();
   const [destinationBankAccountId, setDestinationBankAccountId] = useState<
      string | undefined
   >();
   const [isPending, startTransition] = useTransition();
   const options = bankAccounts.map((a) => ({ value: a.id, label: a.name }));

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Transferir transações</CredenzaTitle>
            <CredenzaDescription>
               Converter {selectedCount}{" "}
               {selectedCount === 1 ? "transação" : "transações"} em
               transferências entre contas
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
               <p className="text-sm font-medium">Conta de Origem</p>
               <Combobox
                  emptyMessage="Nenhuma conta encontrada."
                  onValueChange={setBankAccountId}
                  options={options}
                  placeholder="Origem..."
                  searchPlaceholder="Buscar conta..."
                  value={bankAccountId}
               />
            </div>
            <ArrowRight className="size-4 mb-[18px] shrink-0 text-muted-foreground" />
            <div className="flex flex-1 flex-col gap-2">
               <p className="text-sm font-medium">Conta de Destino</p>
               <Combobox
                  emptyMessage="Nenhuma conta encontrada."
                  onValueChange={setDestinationBankAccountId}
                  options={options}
                  placeholder="Destino..."
                  searchPlaceholder="Buscar conta..."
                  value={destinationBankAccountId}
               />
            </div>
         </CredenzaBody>
         <CredenzaFooter className="grid gap-2 w-full">
            <Button
               className="w-full"
               disabled={isPending}
               onClick={onCancel}
               variant="outline"
            >
               Cancelar
            </Button>
            <Button
               className="w-full"
               disabled={
                  !bankAccountId || !destinationBankAccountId || isPending
               }
               onClick={() =>
                  startTransition(async () => {
                     await onApply(
                        bankAccountId ?? "",
                        destinationBankAccountId ?? "",
                     );
                  })
               }
            >
               {isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
               Aplicar
            </Button>
         </CredenzaFooter>
      </>
   );
}
