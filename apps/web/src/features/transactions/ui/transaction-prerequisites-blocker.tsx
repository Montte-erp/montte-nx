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
}

export function TransactionPrerequisitesBlocker({
   onAction,
}: TransactionPrerequisitesBlockerProps) {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Conta bancária necessária</CredenzaTitle>
            <CredenzaDescription>
               Para criar um lançamento, você precisa ter pelo menos uma conta
               bancária cadastrada.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <div className="flex flex-col items-center gap-4 py-4 text-center">
               <div className="rounded-full bg-muted p-4">
                  <Landmark className="size-8 text-muted-foreground" />
               </div>
               <p className="text-sm text-muted-foreground max-w-xs">
                  Cadastre uma conta bancária primeiro. Você poderá criar
                  lançamentos logo após.
               </p>
            </div>
         </CredenzaBody>
         <CredenzaFooter>
            <Button className="w-full" onClick={onAction}>
               Cadastrar conta bancária
            </Button>
         </CredenzaFooter>
      </>
   );
}
