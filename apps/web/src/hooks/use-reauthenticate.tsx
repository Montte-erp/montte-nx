import { Button } from "@packages/ui/components/button";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
import { Label } from "@packages/ui/components/label";
import { PasswordInput } from "@packages/ui/components/password-input";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { closeDialogStack, openDialogStack } from "./use-dialog-stack";

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
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Confirmar identidade</DialogStackTitle>
            <DialogStackDescription>
               Digite sua senha para continuar.
            </DialogStackDescription>
         </DialogStackHeader>
         <div className="flex-1 overflow-y-auto px-4 py-4">
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
         </div>
         <div className="border-t px-4 py-4">
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
         </div>
      </DialogStackContent>
   );
}

export function useReauthenticate() {
   const reauthenticate = useCallback(
      (onSuccess: () => void, onCancel?: () => void) => {
         openDialogStack({
            children: (
               <ReauthContent
                  onCancel={() => {
                     closeDialogStack();
                     onCancel?.();
                  }}
                  onSuccess={() => {
                     closeDialogStack();
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
