/**
 * Encryption Settings Section
 *
 * Displays encryption status and controls for both server-side
 * and E2E encryption in the settings page.
 */

import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Lock, Server, Shield, ShieldCheck, Unlock } from "lucide-react";
import { Suspense, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import {
   EncryptionProvider,
   useEncryptionContext,
} from "@/features/encryption/hooks/use-encryption-context";
import { EncryptionSetupCredenza } from "@/features/encryption/ui/encryption-setup-credenza";
import { EncryptionUnlockDialog } from "@/features/encryption/ui/encryption-unlock-dialog";
import { openCredenza } from "@/hooks/use-credenza";

function EncryptionSectionSkeleton() {
   return (
      <Card className="h-full">
         <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
         </CardHeader>
         <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
         </CardContent>
      </Card>
   );
}

function EncryptionSectionErrorFallback(props: FallbackProps) {
   return (
      <Card className="h-full">
         <CardHeader>
            <CardTitle>Criptografia</CardTitle>
            <CardDescription>
               Proteja seus dados com criptografia de ponta a ponta.
            </CardDescription>
         </CardHeader>
         <CardContent>
            {createErrorFallback({
               errorDescription:
                  "Não foi possível carregar as configurações de criptografia.",
               errorTitle: "Erro ao carregar",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function EncryptionSectionContent() {
   const {
      serverEncryptionEnabled,
      e2eEnabled,
      isUnlocked,
      isLoading,
      needsUnlock,
      lock,
      enableE2E,
   } = useEncryptionContext();

   const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);

   const handleSetupE2E = () => {
      openCredenza({
         children: <EncryptionSetupCredenza enableE2E={enableE2E} />,
      });
   };

   if (isLoading) {
      return <EncryptionSectionSkeleton />;
   }

   return (
      <>
         <Card className="h-full">
            <CardHeader>
               <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5" />
                  Criptografia
               </CardTitle>
               <CardDescription>
                  Proteja seus dados com criptografia de ponta a ponta.
               </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               {/* Encryption Status Summary */}
               <div className="rounded-lg bg-secondary/50 p-4 text-center">
                  <p className="text-xs md:text-sm text-muted-foreground mb-1">
                     Status da criptografia
                  </p>
                  <div className="flex items-center justify-center gap-2">
                     {e2eEnabled ? (
                        <>
                           <ShieldCheck className="size-5 text-green-500" />
                           <span className="text-lg font-semibold text-green-500">
                              Criptografia E2E Ativada
                           </span>
                        </>
                     ) : serverEncryptionEnabled ? (
                        <>
                           <Server className="size-5 text-blue-500" />
                           <span className="text-lg font-semibold text-blue-500">
                              Criptografia do Servidor
                           </span>
                        </>
                     ) : (
                        <>
                           <Shield className="size-5 text-muted-foreground" />
                           <span className="text-lg font-semibold text-muted-foreground">
                              Sem Criptografia
                           </span>
                        </>
                     )}
                  </div>
                  {e2eEnabled && (
                     <Badge
                        className="mt-2"
                        variant={isUnlocked ? "default" : "secondary"}
                     >
                        {isUnlocked ? "Desbloqueado" : "Bloqueado"}
                     </Badge>
                  )}
               </div>

               <ItemGroup>
                  {/* Server-side Encryption Status */}
                  <Item variant="muted">
                     <ItemMedia variant="icon">
                        <Server className="size-4" />
                     </ItemMedia>
                     <ItemContent className="min-w-0">
                        <ItemTitle>Criptografia do Servidor</ItemTitle>
                        <ItemDescription className="line-clamp-2">
                           Seus dados são criptografados automaticamente no
                           servidor.
                        </ItemDescription>
                     </ItemContent>
                     <ItemActions>
                        <Badge
                           variant={
                              serverEncryptionEnabled ? "default" : "secondary"
                           }
                        >
                           {serverEncryptionEnabled ? "Ativado" : "Desativado"}
                        </Badge>
                     </ItemActions>
                  </Item>

                  <ItemSeparator />

                  {/* E2E Encryption Status */}
                  <Item variant="muted">
                     <ItemMedia variant="icon">
                        <Lock className="size-4" />
                     </ItemMedia>
                     <ItemContent className="min-w-0">
                        <ItemTitle>Criptografia de Ponta a Ponta</ItemTitle>
                        <ItemDescription className="line-clamp-2">
                           Criptografia adicional onde só você pode ler seus
                           dados.
                        </ItemDescription>
                     </ItemContent>
                     <ItemActions>
                        {e2eEnabled ? (
                           <div className="flex gap-2">
                              {needsUnlock ? (
                                 <Button
                                    onClick={() => setUnlockDialogOpen(true)}
                                    size="sm"
                                    variant="outline"
                                 >
                                    <Unlock className="size-4 mr-2" />
                                    Desbloquear
                                 </Button>
                              ) : (
                                 <Button
                                    onClick={() => lock()}
                                    size="sm"
                                    variant="outline"
                                 >
                                    <Lock className="size-4 mr-2" />
                                    Bloquear
                                 </Button>
                              )}
                           </div>
                        ) : (
                           <Button onClick={handleSetupE2E} size="sm">
                              Configurar E2E
                           </Button>
                        )}
                     </ItemActions>
                  </Item>
               </ItemGroup>

               {/* E2E Limitations Note */}
               {e2eEnabled && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                     <p className="font-medium mb-1">
                        Limitações da criptografia E2E:
                     </p>
                     <ul className="list-disc pl-4 space-y-0.5">
                        <li>
                           Pesquisa no servidor não funciona para dados
                           criptografados
                        </li>
                        <li>
                           Relatórios mostram valores criptografados até
                           desbloquear
                        </li>
                        <li>
                           Automações não podem ler campos criptografados
                        </li>
                     </ul>
                  </div>
               )}
            </CardContent>
         </Card>

         <EncryptionUnlockDialog
            onOpenChange={setUnlockDialogOpen}
            open={unlockDialogOpen}
         />
      </>
   );
}

export function EncryptionSection() {
   return (
      <ErrorBoundary FallbackComponent={EncryptionSectionErrorFallback}>
         <Suspense fallback={<EncryptionSectionSkeleton />}>
            <EncryptionProvider>
               <EncryptionSectionContent />
            </EncryptionProvider>
         </Suspense>
      </ErrorBoundary>
   );
}
