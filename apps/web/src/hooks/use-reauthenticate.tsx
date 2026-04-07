import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Label } from "@packages/ui/components/label";
import { PasswordInput } from "@packages/ui/components/password-input";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { closeCredenza, openCredenza } from "./use-credenza";

interface ReauthContentProps {
   onSuccess: () => void;
   onCancel: () => void;
}

function ReauthContent({ onSuccess, onCancel }: ReauthContentProps) {
   const [password, setPassword] = useState("");

   const verifyMutation = useMutation({
      mutationFn: async () => {
         const result = await orpc.account.verifyPassword.call({ password });
         if (!result.valid) throw new Error("Senha incorreta");
      },
      onSuccess: () => {
         onSuccess();
      },
      onError: (error) => {
         toast.error(
            error instanceof Error ? error.message : "Senha incorreta",
         );
      },
   });

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Confirmar identidade</CredenzaTitle>
            <CredenzaDescription>
               Digite sua senha para continuar.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <div className="flex flex-col gap-2">
               <Label htmlFor="reauth-password">Senha</Label>
               <PasswordInput
                  autoFocus
                  id="reauth-password"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                     if (e.key === "Enter" && password.length > 0)
                        verifyMutation.mutate();
                  }}
                  placeholder="••••••••"
                  value={password}
               />
            </div>
         </CredenzaBody>
         <CredenzaFooter>
            <div className="flex gap-2">
               <Button onClick={onCancel} variant="outline">
                  Cancelar
               </Button>
               <Button
                  disabled={password.length === 0 || verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate()}
               >
                  {verifyMutation.isPending && (
                     <Loader2 className="size-4 mr-2 animate-spin" />
                  )}
                  Confirmar
               </Button>
            </div>
         </CredenzaFooter>
      </>
   );
}

export function useReauthenticate() {
   const reauthenticate = useCallback(
      (onSuccess: () => void, onCancel?: () => void) => {
         openCredenza({
            children: (
               <ReauthContent
                  onCancel={() => {
                     closeCredenza();
                     onCancel?.();
                  }}
                  onSuccess={() => {
                     closeCredenza();
                     onSuccess();
                  }}
               />
            ),
         });
      },
      [],
   );

   return { reauthenticate };
}
