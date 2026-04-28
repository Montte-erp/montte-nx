import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Separator } from "@packages/ui/components/separator";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { KeyRound, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { TermsAndPrivacyText } from "../-auth/terms-and-privacy-text";

const signInSearchSchema = z.object({
   redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-in/")({
   validateSearch: signInSearchSchema,
   beforeLoad: async ({ search, context }) => {
      const session = await context.queryClient
         .fetchQuery(orpc.session.getSession.queryOptions())
         .catch(() => null);
      if (session) {
         // If there's a redirect URL, use it; otherwise go to auth callback
         if (search.redirect) {
            throw redirect({ to: search.redirect });
         }
         throw redirect({ to: "/auth/callback" });
      }
   },
   component: SignInPage,
});

export function SignInPage() {
   const [lastMethod, setLastMethod] = useState<string | null>(null);

   useEffect(() => {
      setLastMethod(authClient.getLastUsedLoginMethod());
   }, []);

   return (
      <section className="flex flex-col gap-4 w-full">
         {/* Header */}
         <div className="text-center flex flex-col gap-2">
            <h1 className="text-3xl font-semibold font-serif">Entrar</h1>
            <p className="text-muted-foreground text-sm">
               Bom te ver de volta. O ERP com IA espera por voce.
            </p>
         </div>

         {/* Primary methods */}
         <div className="flex flex-col gap-4">
            {/* Magic Link */}
            <div className="relative">
               {lastMethod === "magicLink" && (
                  <Badge
                     className="absolute -top-2 -right-2 z-10"
                     variant="default"
                  >
                     Ultimo usado
                  </Badge>
               )}
               <Button asChild className="w-full h-11 gap-2" variant="outline">
                  <Link to="/auth/magic-link">
                     <Sparkles className="size-4" />
                     Link Magico
                  </Link>
               </Button>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-3">
               <Separator className="flex-1" />
               <span className="text-xs text-muted-foreground">ou</span>
               <Separator className="flex-1" />
            </div>

            {/* Secondary — Email & Password */}
            <div className="relative">
               {lastMethod === "email" && (
                  <Badge
                     className="absolute -top-2 -right-2 z-10"
                     variant="default"
                  >
                     Ultimo usado
                  </Badge>
               )}
               <Button asChild className="w-full h-11 gap-2" variant="ghost">
                  <Link to="/auth/sign-in/email">
                     <KeyRound className="size-4" />
                     Entrar com Email e Senha
                  </Link>
               </Button>
            </div>
         </div>

         {/* Footer */}
         <div className="text-sm text-center flex flex-col gap-4">
            <div className="flex gap-1 justify-center items-center">
               <span>Primeira vez aqui? </span>
               <Link
                  className="text-primary font-medium hover:underline"
                  to="/auth/sign-up"
               >
                  Criar conta
               </Link>
            </div>
            <TermsAndPrivacyText />
         </div>
      </section>
   );
}
