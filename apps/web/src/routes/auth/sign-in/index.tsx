import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { FieldDescription } from "@packages/ui/components/field";
import { Separator } from "@packages/ui/components/separator";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { KeyRound, Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { z } from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

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

const GoogleIcon = () => (
   <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
         d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
         fill="#4285F4"
      />
      <path
         d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
         fill="#34A853"
      />
      <path
         d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
         fill="#FBBC05"
      />
      <path
         d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
         fill="#EA4335"
      />
   </svg>
);

export function SignInPage() {
   const [lastMethod, setLastMethod] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

   useEffect(() => {
      setLastMethod(authClient.getLastUsedLoginMethod());
   }, []);

   const handleGoogleSignIn = () => {
      startTransition(async () => {
         await authClient.signIn.social({
            provider: "google",
            callbackURL: "/auth/callback",
         });
      });
   };

   const TermsAndPrivacyText = () => {
      const text =
         "Ao continuar, voce concorda com nossos {split} e {split}.".split(
            "{split}",
         );

      return (
         <>
            <span>{text[0]}</span>
            <a
               className="underline text-muted-foreground hover:text-primary"
               href="https://montte.co/terms-of-service"
               rel="noopener noreferrer"
               target="_blank"
            >
               Termos de Servico
            </a>
            <span>{text[1]}</span>
            <a
               className="underline text-muted-foreground hover:text-primary"
               href="https://montte.co/privacy-policy"
               rel="noopener noreferrer"
               target="_blank"
            >
               Politica de Privacidade
            </a>
            <span>{text[2]}</span>
         </>
      );
   };

   return (
      <section className="space-y-8 w-full">
         {/* Header */}
         <div className="text-center space-y-2">
            <h1 className="text-3xl font-semibold font-serif">Entrar</h1>
            <p className="text-muted-foreground text-sm">
               Bom te ver de volta. O ERP com IA espera por voce.
            </p>
         </div>

         {/* Primary methods — 2-column grid */}
         <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
               {/* Google */}
               <div className="relative">
                  {lastMethod === "google" && (
                     <Badge
                        className="absolute -top-2 -right-2 z-10"
                        variant="default"
                     >
                        Ultimo usado
                     </Badge>
                  )}
                  <Button
                     className="w-full h-11 gap-2"
                     disabled={isPending}
                     onClick={handleGoogleSignIn}
                     variant="outline"
                  >
                     <GoogleIcon />
                     Google
                  </Button>
               </div>

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
                  <Button
                     asChild
                     className="w-full h-11 gap-2"
                     variant="outline"
                  >
                     <Link to="/auth/magic-link">
                        <Sparkles className="size-4" />
                        Link Magico
                     </Link>
                  </Button>
               </div>
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
         <div className="text-sm text-center space-y-4">
            <div className="flex gap-1 justify-center items-center">
               <span>Primeira vez aqui? </span>
               <Link
                  className="text-primary font-medium hover:underline"
                  to="/auth/sign-up"
               >
                  Criar conta
               </Link>
            </div>
            <FieldDescription className="text-center">
               <TermsAndPrivacyText />
            </FieldDescription>
         </div>
      </section>
   );
}
