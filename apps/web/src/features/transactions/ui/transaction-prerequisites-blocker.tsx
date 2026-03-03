import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Landmark } from "lucide-react";

interface TransactionPrerequisitesBlockerProps {
   onAction: () => void;
   onCancel: () => void;
}

export function TransactionPrerequisitesBlocker({
   onAction,
   onCancel,
}: TransactionPrerequisitesBlockerProps) {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Conta bancária necessária</CredenzaTitle>
            <CredenzaDescription>
               Para criar uma transação, você precisa ter pelo menos uma conta
               bancária cadastrada.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="flex flex-col items-center gap-4 py-4 text-center">
               <div className="rounded-full bg-muted p-4">
                  <Landmark className="size-8 text-muted-foreground" />
               </div>
               <p className="text-sm text-muted-foreground max-w-xs">
                  Cadastre uma conta bancária primeiro. Você poderá criar
                  transações logo após.
               </p>
            </div>
         </CredenzaBody>
         <CredenzaFooter className="flex-col w-full flex gap-2">
            <Button className="w-full" onClick={onAction}>
               Cadastrar conta bancária
            </Button>
            <Button className="w-full" onClick={onCancel} variant="outline">
               Cancelar
            </Button>
         </CredenzaFooter>
      </>
   );
}
