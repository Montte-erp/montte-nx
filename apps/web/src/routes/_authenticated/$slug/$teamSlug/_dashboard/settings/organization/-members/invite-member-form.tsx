import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { authClient } from "@/integrations/better-auth/auth-client";

export function InviteMemberForm({
   organizationId,
   onSuccess,
}: {
   organizationId: string;
   onSuccess: () => void;
}) {
   const [email, setEmail] = useState("");
   const [role, setRole] = useState<"member" | "admin">("member");
   const queryClient = useQueryClient();
   const [isPending, startTransition] = useTransition();

   const handleInvite = () => {
      startTransition(async () => {
         const result = await authClient.organization.inviteMember({
            email,
            role,
            organizationId,
         });
         if (result.error) {
            toast.error(result.error.message ?? "Erro ao enviar convite.");
            return;
         }
         queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
         toast.success("Convite enviado com sucesso!");
         onSuccess();
      });
   };

   const isValid = email.trim().length > 0 && email.includes("@");

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Convidar novo membro</CredenzaTitle>
            <CredenzaDescription>
               Adicione um novo membro à organização enviando um convite por
               e-mail.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="px-4">
            <div className="flex flex-col gap-4">
               <div className="flex gap-2 items-end">
                  <div className="flex-1 flex flex-col gap-2">
                     <Label htmlFor="invite-email">E-mail</Label>
                     <Input
                        autoComplete="email"
                        id="invite-email"
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => {
                           if (e.key === "Enter" && isValid && !isPending) {
                              handleInvite();
                           }
                        }}
                        placeholder="usuario@empresa.com"
                        type="email"
                        value={email}
                     />
                  </div>
                  <div className="w-36 flex flex-col gap-2 shrink-0">
                     <Label htmlFor="invite-role">Função</Label>
                     <Select
                        onValueChange={(v) => setRole(v as "member" | "admin")}
                        value={role}
                     >
                        <SelectTrigger className="w-full" id="invite-role">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="member">Membro</SelectItem>
                           <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               <Card className="bg-muted border-0">
                  <CardContent className="pt-4 pb-4">
                     <div className="flex gap-4">
                        <div className="mt-0.5">
                           <Mail className="size-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col gap-2">
                           <p className="text-sm font-medium">
                              Como funciona o convite
                           </p>
                           <p className="text-xs text-muted-foreground">
                              Um e-mail será enviado com um link de convite. O
                              destinatário poderá criar uma conta ou fazer login
                              para aceitar o convite.
                           </p>
                        </div>
                     </div>
                  </CardContent>
               </Card>
            </div>
         </CredenzaBody>

         <CredenzaFooter>
            <Button
               className="w-full"
               disabled={!isValid || isPending}
               onClick={handleInvite}
            >
               {isPending ? (
                  <Spinner className="size-4 mr-2" />
               ) : (
                  <Mail className="size-4 mr-2" />
               )}
               Enviar convite
            </Button>
         </CredenzaFooter>
      </>
   );
}
