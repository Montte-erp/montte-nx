import { Button } from "@packages/ui/components/button";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
import { Landmark } from "lucide-react";

interface TransactionPrerequisitesBlockerProps {
   onAction: () => void;
}

export function TransactionPrerequisitesBlocker({
   onAction,
}: TransactionPrerequisitesBlockerProps) {
   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Conta bancária necessária</DialogStackTitle>
            <DialogStackDescription>
               Para criar um lançamento, você precisa ter pelo menos uma conta
               bancária cadastrada.
            </DialogStackDescription>
         </DialogStackHeader>
         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col items-center gap-4 py-4 text-center">
               <div className="rounded-full bg-muted p-4">
                  <Landmark className="size-8 text-muted-foreground" />
               </div>
               <p className="text-sm text-muted-foreground max-w-xs">
                  Cadastre uma conta bancária primeiro. Você poderá criar
                  lançamentos logo após.
               </p>
            </div>
         </div>
         <div className="border-t px-4 py-4">
            <Button className="w-full" onClick={onAction}>
               Cadastrar conta bancária
            </Button>
         </div>
      </DialogStackContent>
   );
}
